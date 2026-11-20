<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\DigitalKey;
use App\Models\Offer;
use App\Models\Product;
use App\Models\Seller;
use App\Models\User;
use Database\Seeders\DemoMarketplaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductCartTest extends TestCase
{
    use RefreshDatabase;

    public function test_detail_offers_belong_to_this_product_and_are_sorted_by_price_including_sold_out(): void
    {
        $product = Product::factory()->create(['requirements' => ['kind' => 'activation', 'minimum' => [['label' => 'Account', 'value' => 'Demo platform account']], 'recommended' => [], 'notes' => []], 'delivery_information' => 'Digital demo delivery', 'compatibility_notice' => 'This platform only']);
        $soldOut = Offer::factory()->for($product)->create(['price_minor' => 500]);
        $cheaper = Offer::factory()->for($product)->inStock(2)->create(['price_minor' => 1200]);
        $dearer = Offer::factory()->for($product)->inStock(5)->create(['price_minor' => 2000]);
        Offer::factory()->for($product)->inStock()->create(['is_active' => false]);
        Offer::factory()->for($product)->for(Seller::factory()->create(['status' => 'suspended']))->inStock()->create();
        Offer::factory()->inStock()->create();
        $response = $this->getJson('/api/v1/products/'.$product->slug)->assertOk()->assertJsonCount(3, 'data.offers')
            ->assertJsonPath('data.price_minor', 1200)->assertJsonPath('data.requirements.minimum.0.value', 'Demo platform account')
            ->assertJsonPath('data.delivery_information', 'Digital demo delivery')->assertJsonPath('data.compatibility_notice', 'This platform only');
        $this->assertSame([$soldOut->id, $cheaper->id, $dearer->id], array_column($response->json('data.offers'), 'id'));
        foreach ($response->json('data.offers') as $offer) {
            $this->assertSame($product->id, $offer['product_id']);
        }
        $this->getJson('/api/v1/products')->assertOk()->assertJsonMissingPath('data.0.requirements');
    }

    public function test_empty_cart_read_does_not_create_database_carts(): void
    {
        $this->getJson('/api/v1/cart')->assertOk()->assertJsonPath('data.id', null)->assertJsonPath('data.items_count', 0)->assertJsonPath('data.total_minor', 0);
        $this->assertDatabaseCount('carts', 0);
    }

    public function test_add_uses_the_selected_seller_offer_price_and_does_not_allocate_keys(): void
    {
        $product = Product::factory()->create();
        Offer::factory()->for($product)->inStock(3)->create(['price_minor' => 1000]);
        $selected = Offer::factory()->for($product)->inStock(5)->create(['price_minor' => 2400]);
        $stockBefore = DigitalKey::available()->count();
        $response = $this->postJson('/api/v1/cart/items', ['offer_id' => $selected->id, 'quantity' => 2])->assertOk()
            ->assertJsonPath('data.items.0.offer_id', $selected->id)->assertJsonPath('data.items.0.product.id', $product->id)
            ->assertJsonPath('data.items.0.seller.id', $selected->seller_id)->assertJsonPath('data.items.0.unit_price_minor', 2400)
            ->assertJsonPath('data.items.0.line_total_minor', 4800)->assertJsonPath('data.total_minor', 4800);
        $this->assertSame($selected->id, CartItem::sole()->offer_id);
        $this->assertSame($stockBefore, DigitalKey::available()->count());
        $this->assertNull(Cart::sole()->user_id);
        $this->withSession(['guest_cart_id' => $response->json('data.id')])->getJson('/api/v1/cart')->assertOk()
            ->assertJsonPath('data.items.0.offer_id', $selected->id)->assertJsonPath('data.items_count', 2);
        $this->assertStringNotContainsString('key_ciphertext', $response->getContent());
        $this->assertStringNotContainsString('fingerprint', $response->getContent());
    }

    public function test_same_product_from_two_sellers_remains_two_distinct_cart_lines(): void
    {
        $product = Product::factory()->create();
        $first = Offer::factory()->for($product)->inStock(5)->create(['price_minor' => 1000]);
        $second = Offer::factory()->for($product)->inStock(5)->create(['price_minor' => 2000]);
        $cartId = $this->postJson('/api/v1/cart/items', ['offer_id' => $first->id])->assertOk()->json('data.id');
        $this->withSession(['guest_cart_id' => $cartId])->postJson('/api/v1/cart/items', ['offer_id' => $second->id])->assertOk()
            ->assertJsonCount(2, 'data.items')->assertJsonPath('data.total_minor', 3000);
        $this->withSession(['guest_cart_id' => $cartId])->postJson('/api/v1/cart/items', ['offer_id' => $first->id])->assertOk()
            ->assertJsonCount(2, 'data.items')->assertJsonPath('data.items_count', 3)->assertJsonPath('data.total_minor', 4000);
        $this->assertSame(2, CartItem::where('offer_id', $first->id)->sole()->quantity);
        $this->assertSame(1, CartItem::where('offer_id', $second->id)->sole()->quantity);
    }

    public function test_cart_mutations_check_stock_and_quantity_atomically_without_seller_substitution(): void
    {
        $offer = Offer::factory()->inStock(2)->create();
        $cart = $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id, 'quantity' => 2])->assertOk()->json('data');
        $this->withSession(['guest_cart_id' => $cart['id']])->postJson('/api/v1/cart/items', ['offer_id' => $offer->id])->assertStatus(409)->assertJsonPath('error.code', 'conflict');
        $this->assertSame(2, CartItem::sole()->quantity);
        $this->assertSame($cart['version'], Cart::sole()->version);
        $this->withSession(['guest_cart_id' => $cart['id']])->patchJson('/api/v1/cart/items/'.$cart['items'][0]['id'], ['quantity' => 1])->assertOk()
            ->assertJsonPath('data.items_count', 1)->assertJsonPath('data.version', $cart['version'] + 1);
    }

    public function test_sold_out_and_hidden_offers_cannot_be_added(): void
    {
        $soldOut = Offer::factory()->create();
        $hidden = Offer::factory()->inStock()->create(['is_active' => false]);
        $suspended = Offer::factory()->for(Seller::factory()->create(['status' => 'suspended']))->inStock()->create();
        $unpublished = Offer::factory()->for(Product::factory()->create(['is_active' => false]))->inStock()->create();
        $this->postJson('/api/v1/cart/items', ['offer_id' => $soldOut->id])->assertStatus(409);
        foreach ([$hidden, $suspended, $unpublished] as $offer) {
            $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id])->assertNotFound();
        }
        $this->assertDatabaseCount('carts', 0);
        $this->assertDatabaseCount('cart_items', 0);
    }

    public function test_client_cannot_supply_price_product_owner_or_invalid_quantities(): void
    {
        $offer = Offer::factory()->inStock()->create();
        foreach ([['quantity' => 0], ['quantity' => 10], ['quantity' => 1.5], ['price_minor' => 1], ['product_id' => $offer->product_id], ['cart_id' => fake()->uuid()], ['user_id' => User::factory()->create()->id]] as $extra) {
            $this->postJson('/api/v1/cart/items', array_merge(['offer_id' => $offer->id], $extra))->assertUnprocessable()->assertJsonPath('error.code', 'validation_failed');
        }
        $this->postJson('/api/v1/cart/items', ['offer_id' => 'invalid'])->assertUnprocessable();
        $this->assertDatabaseCount('cart_items', 0);
    }

    public function test_guest_cart_identity_and_foreign_line_mutations_are_session_scoped(): void
    {
        $a = Cart::factory()->create();
        $b = Cart::factory()->create();
        $item = CartItem::factory()->for($a)->for(Offer::factory()->inStock()->create())->create();
        $this->withSession(['guest_cart_id' => $b->id])->getJson('/api/v1/cart')->assertOk()->assertJsonCount(0, 'data.items');
        $this->withSession(['guest_cart_id' => $b->id])->deleteJson('/api/v1/cart/items/'.$item->id)->assertNotFound();
        $this->withSession(['guest_cart_id' => $b->id])->patchJson('/api/v1/cart/items/'.$item->id, ['quantity' => 2])->assertNotFound();
        $this->assertSame(1, $item->refresh()->quantity);
        $this->withSession(['guest_cart_id' => $a->id])->getJson('/api/v1/cart')->assertOk()->assertJsonPath('data.items.0.id', $item->id);
    }

    public function test_authenticated_cart_uses_current_user_and_never_a_guest_or_other_user_cart(): void
    {
        $user = User::factory()->create();
        $other = Cart::factory()->owned()->create();
        $foreign = CartItem::factory()->for($other)->create();
        $offer = Offer::factory()->inStock()->create();
        $this->actingAs($user)->withSession(['guest_cart_id' => $other->id])->getJson('/api/v1/cart')->assertOk()->assertJsonCount(0, 'data.items');
        $cart = $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id])->assertOk()->json('data');
        $this->assertSame($user->id, Cart::findOrFail($cart['id'])->user_id);
        $this->deleteJson('/api/v1/cart/items/'.$foreign->id)->assertNotFound();
    }

    public function test_unavailable_lines_stay_visible_at_current_price_and_can_be_removed(): void
    {
        $offer = Offer::factory()->inStock()->create();
        $cart = $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id])->assertOk()->json('data');
        $offer->update(['price_minor' => 2500, 'is_active' => false]);
        $this->withSession(['guest_cart_id' => $cart['id']])->getJson('/api/v1/cart')->assertOk()
            ->assertJsonPath('data.items.0.unit_price_minor', 2500)->assertJsonPath('data.items.0.is_available', false)
            ->assertJsonPath('data.has_unavailable_items', true);
        $this->patchJson('/api/v1/cart/items/'.$cart['items'][0]['id'], ['quantity' => 2])->assertStatus(409);
        $this->deleteJson('/api/v1/cart/items/'.$cart['items'][0]['id'])->assertOk()->assertJsonCount(0, 'data.items')->assertJsonPath('data.total_minor', 0);
    }

    public function test_cart_quantity_and_line_limits_are_enforced(): void
    {
        $offer = Offer::factory()->inStock(12)->create();
        $cart = $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id, 'quantity' => 9])->assertOk()->json('data');
        $this->withSession(['guest_cart_id' => $cart['id']])->postJson('/api/v1/cart/items', ['offer_id' => $offer->id])->assertStatus(409);
        CartItem::factory()->count(19)->for(Cart::findOrFail($cart['id']))->create();
        $extra = Offer::factory()->inStock()->create();
        $this->postJson('/api/v1/cart/items', ['offer_id' => $extra->id])->assertStatus(409);
        $this->assertDatabaseCount('cart_items', 20);
    }

    public function test_all_seeded_products_have_requirements_compatibility_and_delivery_data(): void
    {
        $this->seed(DemoMarketplaceSeeder::class);
        foreach (Product::with('platform')->get() as $product) {
            $this->assertNotEmpty($product->requirements['minimum']);
            $this->assertNotEmpty($product->compatibility_notice);
            $this->assertNotEmpty($product->delivery_information);
            $this->assertCount(3, $product->requirements['activation_steps']);
            if ($product->platform->slug === 'steam' && $product->type === 'game') {
                $this->assertSame('pc', $product->requirements['kind']);
                $this->assertStringStartsWith('https://store.steampowered.com/app/', $product->requirements['source_url']);
            }
        }
    }
}
