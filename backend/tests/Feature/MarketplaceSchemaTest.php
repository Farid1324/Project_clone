<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Category;
use App\Models\DigitalKey;
use App\Models\Offer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PaymentAttempt;
use App\Models\Product;
use App\Models\Seller;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MarketplaceSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_catalog_relationships_and_independent_offer_inventory(): void
    {
        $category = Category::factory()->create();
        $product = Product::factory()->hasAttached($category)->create();
        $offers = Offer::factory()->count(3)->for($product)->inStock(2)->create();
        $this->assertTrue($product->platform()->exists());
        $this->assertTrue($product->region()->exists());
        $this->assertSame($product->id, $category->products()->sole()->id);
        $this->assertCount(3, $product->offers);
        foreach ($offers as $offer) {
            $this->assertSame($product->id, $offer->product->id);
            $this->assertSame(1, $offer->seller->offers()->count());
            $this->assertSame(2, $offer->availableKeys()->count());
        }
    }

    public function test_guest_and_account_carts_have_owned_offer_lines(): void
    {
        $user = User::factory()->create();
        $cart = Cart::factory()->for($user)->create();
        $line = CartItem::factory()->for($cart)->create(['quantity' => 2]);
        $guest = Cart::factory()->create();
        $this->assertNull($guest->user_id);
        $this->assertSame($cart->id, $user->cart->id);
        $this->assertSame($user->id, $line->cart->user->id);
        $this->assertSame($line->offer_id, $cart->items->sole()->offer->id);
    }

    public function test_order_snapshots_payment_and_delivered_keys_have_consistent_relationships(): void
    {
        $offer = Offer::factory()->create();
        $order = Order::factory()->create(['status' => 'fulfilled', 'fulfilled_at' => now(), 'total_minor' => 3998]);
        $item = OrderItem::factory()->for($order)->for($offer)->create(['quantity' => 2, 'unit_price_minor' => 1999]);
        $payment = PaymentAttempt::factory()->for($order)->create(['scenario' => 'approve', 'status' => 'approved', 'amount_minor' => 3998]);
        $keys = DigitalKey::factory()->count(2)->for($offer)->create(['order_item_id' => $item->id, 'allocated_at' => now()]);
        $this->assertSame(3998, $item->refresh()->line_total_minor);
        $this->assertSame($order->id, $order->user->orders()->sole()->id);
        $this->assertSame($payment->id, $order->paymentAttempt->id);
        $this->assertSame($order->id, $payment->order->id);
        $this->assertSame($item->id, $keys->first()->orderItem->id);
        $this->assertSame(2, $item->digitalKeys()->count());
        $this->assertSame(0, $offer->availableKeys()->count());
        $offer->update(['price_minor' => 4999, 'comparison_price_minor' => 6999]);
        $this->assertSame(1999, $item->refresh()->unit_price_minor);
    }

    public function test_inventory_is_encrypted_and_sensitive_columns_are_hidden(): void
    {
        $key = DigitalKey::factory()->create(['key_ciphertext' => 'DEMO-SECRET-123']);
        $this->assertNotSame('DEMO-SECRET-123', $key->getRawOriginal('key_ciphertext'));
        $this->assertSame('DEMO-SECRET-123', $key->refresh()->key_ciphertext);
        $this->assertArrayNotHasKey('key_ciphertext', $key->toArray());
        $this->assertArrayNotHasKey('fingerprint', $key->toArray());
    }

    public function test_duplicate_key_fingerprints_are_rejected_across_offers(): void
    {
        DigitalKey::factory()->create(['key_ciphertext' => 'DEMO-DUPLICATE']);
        $this->expectException(QueryException::class);
        DigitalKey::factory()->create(['key_ciphertext' => '  demo-duplicate  ']);
    }

    public function test_a_key_cannot_be_assigned_to_an_item_from_a_different_offer(): void
    {
        $key = DigitalKey::factory()->create();
        $item = OrderItem::factory()->create();
        $this->expectException(QueryException::class);
        $key->update(['order_item_id' => $item->id, 'allocated_at' => now()]);
    }

    public function test_a_key_allocation_requires_a_timestamp(): void
    {
        $offer = Offer::factory()->create();
        $item = OrderItem::factory()->for($offer)->create();
        $this->expectException(QueryException::class);
        DigitalKey::factory()->for($offer)->create(['order_item_id' => $item->id]);
    }

    public function test_a_user_cannot_have_two_account_carts(): void
    {
        $user = User::factory()->create();
        Cart::factory()->for($user)->create();
        $this->expectException(QueryException::class);
        Cart::factory()->for($user)->create();
    }

    public function test_database_rejects_negative_offer_prices(): void
    {
        $this->expectException(QueryException::class);
        Offer::factory()->create(['price_minor' => -1]);
    }

    public function test_database_rejects_invalid_seller_ratings(): void
    {
        $this->expectException(QueryException::class);
        Seller::factory()->create(['rating' => 5.5]);
    }

    public function test_order_snapshots_are_immutable_through_the_model(): void
    {
        $item = OrderItem::factory()->create();
        $this->expectException(\LogicException::class);
        $item->update(['quantity' => 9]);
    }

    public function test_category_pivot_deletion_preserves_products(): void
    {
        $category = Category::factory()->create();
        $product = Product::factory()->hasAttached($category)->create();
        $category->delete();
        $this->assertTrue($product->fresh()->exists);
        $this->assertSame(0, $product->categories()->count());
    }
}
