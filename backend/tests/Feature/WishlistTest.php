<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\DigitalKey;
use App\Models\Offer;
use App\Models\Product;
use App\Models\User;
use App\Models\WishlistItem;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class WishlistTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_wishlist_endpoint_requires_authentication(): void
    {
        $product = Product::factory()->create();
        $this->getJson('/api/v1/wishlist')->assertUnauthorized();
        $this->getJson('/api/v1/wishlist/summary')->assertUnauthorized();
        $this->postJson('/api/v1/wishlist', ['product_id' => $product->id])->assertUnauthorized();
        $this->deleteJson('/api/v1/wishlist/'.$product->id)->assertUnauthorized();
        $this->assertDatabaseCount('wishlist_items', 0);
    }

    public function test_saves_are_product_based_idempotent_and_do_not_reserve_inventory(): void
    {
        $user = User::factory()->create();
        $product = Product::factory()->create();
        Offer::factory()->for($product)->inStock(3)->create(['price_minor' => 1200]);
        Offer::factory()->for($product)->inStock(2)->create(['price_minor' => 1500]);
        $this->actingAs($user);
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $this->postJson('/api/v1/wishlist', ['product_id' => $product->id])->assertOk()->assertJsonPath('data.count', 1)->assertJsonPath('data.product_ids.0', $product->id);
        }
        $this->assertDatabaseCount('wishlist_items', 1);
        $this->assertSame($product->id, $user->wishlistItems()->sole()->product->id);
        $this->assertSame($user->id, $product->wishlistItems()->sole()->user->id);
        $this->assertSame(5, DigitalKey::available()->count());
        $this->assertSame(0, Cart::count());
        $this->getJson('/api/v1/wishlist')->assertOk()->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('data.0.id', $product->id)
            ->assertJsonPath('data.0.price_minor', 1200)->assertJsonPath('data.0.available_offer_count', 2)->assertJsonPath('data.0.is_published', true)
            ->assertJsonMissingPath('data.0.offers')->assertJsonMissingPath('data.0.key_ciphertext');
    }

    public function test_accounts_cannot_list_or_remove_each_others_saved_products(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();
        $shared = Product::factory()->create();
        $private = Product::factory()->create();
        WishlistItem::factory()->for($alice)->for($shared)->create();
        WishlistItem::factory()->for($bob)->for($shared)->create();
        WishlistItem::factory()->for($bob)->for($private)->create();
        $this->actingAs($alice)->getJson('/api/v1/wishlist')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $shared->id);
        $this->getJson('/api/v1/wishlist/summary')->assertOk()->assertJsonPath('data.count', 1)->assertJsonPath('data.product_ids', [$shared->id]);
        $this->deleteJson('/api/v1/wishlist/'.$private->id)->assertOk()->assertJsonPath('data.count', 1);
        $this->deleteJson('/api/v1/wishlist/'.$shared->id)->assertOk()->assertJsonPath('data.count', 0);
        $this->assertSame(2, $bob->wishlistItems()->count());
        $this->actingAs($bob)->getJson('/api/v1/wishlist/summary')->assertOk()->assertJsonPath('data.count', 2);
    }

    public function test_removals_are_safe_when_repeated_or_when_the_product_was_never_saved(): void
    {
        $item = WishlistItem::factory()->create();
        $this->actingAs($item->user);
        for ($attempt = 0; $attempt < 2; $attempt++) {
            $this->deleteJson('/api/v1/wishlist/'.$item->product_id)->assertOk()->assertJsonPath('data.count', 0);
        }
        $this->deleteJson('/api/v1/wishlist/'.Str::uuid())->assertOk()->assertJsonPath('data.product_ids', []);
        $this->getJson('/api/v1/wishlist')->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.total', 0);
    }

    public function test_live_prices_and_sold_out_products_remain_visible_without_a_stale_price(): void
    {
        $offer = Offer::factory()->inStock(2)->create(['price_minor' => 1000]);
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/api/v1/wishlist', ['product_id' => $offer->product_id])->assertOk();
        $offer->update(['price_minor' => 1700]);
        $this->getJson('/api/v1/wishlist')->assertOk()->assertJsonPath('data.0.price_minor', 1700)->assertJsonPath('data.0.is_available', true);
        $offer->digitalKeys()->update(['retired_at' => now()]);
        $this->getJson('/api/v1/wishlist')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.price_minor', null)
            ->assertJsonPath('data.0.is_available', false)->assertJsonPath('data.0.available_offer_count', 0);
        $this->getJson('/api/v1/wishlist/summary')->assertOk()->assertJsonPath('data.count', 1);
    }

    public function test_unpublished_saved_products_remain_removable_but_cannot_be_newly_saved(): void
    {
        $offer = Offer::factory()->inStock()->create();
        $item = WishlistItem::factory()->for($offer->product)->create();
        $offer->product->update(['is_active' => false]);
        $this->actingAs($item->user)->getJson('/api/v1/wishlist')->assertOk()->assertJsonPath('data.0.id', $offer->product_id)
            ->assertJsonPath('data.0.is_published', false)->assertJsonPath('data.0.is_available', false)->assertJsonPath('data.0.price_minor', null);
        $this->postJson('/api/v1/wishlist', ['product_id' => $offer->product_id])->assertOk()->assertJsonPath('data.count', 1);
        $this->getJson('/api/v1/products/'.$offer->product->slug)->assertNotFound();
        $this->deleteJson('/api/v1/wishlist/'.$offer->product_id)->assertOk()->assertJsonPath('data.count', 0);
        $this->postJson('/api/v1/wishlist', ['product_id' => $offer->product_id])->assertNotFound();
    }

    public function test_published_products_can_be_saved_without_any_available_offer(): void
    {
        $product = Product::factory()->create();
        $this->actingAs(User::factory()->create())->postJson('/api/v1/wishlist', ['product_id' => $product->id])->assertOk();
        $this->getJson('/api/v1/wishlist')->assertOk()->assertJsonPath('data.0.id', $product->id)->assertJsonPath('data.0.is_available', false);
    }

    public function test_invalid_ids_unsupported_owner_fields_and_invalid_pagination_are_rejected(): void
    {
        $this->actingAs(User::factory()->create());
        $product = Product::factory()->create();
        foreach ([[], ['product_id' => 'not-an-id'], ['product_id' => [$product->id]], ['product_id' => $product->id, 'user_id' => (string) Str::uuid()], ['product_id' => $product->id, 'offer_id' => (string) Str::uuid()]] as $payload) {
            $this->postJson('/api/v1/wishlist', $payload)->assertUnprocessable()->assertJsonStructure(['error' => ['code', 'message', 'fields']]);
        }
        $this->postJson('/api/v1/wishlist', ['product_id' => (string) Str::uuid()])->assertNotFound();
        foreach (['page=0', 'per_page=49', 'user_id='.(string) Str::uuid()] as $query) {
            $this->getJson('/api/v1/wishlist?'.$query)->assertUnprocessable();
        }
        $this->assertDatabaseCount('wishlist_items', 0);
    }

    public function test_pagination_is_stable_and_summary_counts_the_entire_wishlist(): void
    {
        $user = User::factory()->create();
        WishlistItem::factory()->for($user)->count(5)->create();
        WishlistItem::factory()->count(2)->create();
        $this->actingAs($user);
        $first = $this->getJson('/api/v1/wishlist?per_page=2')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.total', 5);
        $second = $this->getJson('/api/v1/wishlist?per_page=2&page=2')->assertOk()->assertJsonCount(2, 'data');
        $this->assertSame([], array_values(array_intersect(array_column($first->json('data'), 'id'), array_column($second->json('data'), 'id'))));
        $this->assertSame(array_column($first->json('data'), 'id'), array_column($this->getJson('/api/v1/wishlist?per_page=2')->json('data'), 'id'));
        $this->getJson('/api/v1/wishlist/summary')->assertOk()->assertJsonPath('data.count', 5)->assertJsonCount(5, 'data.product_ids');
        $this->getJson('/api/v1/wishlist?page=9999')->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.total', 5);
    }

    public function test_database_uniqueness_prevents_duplicate_user_product_pairs(): void
    {
        $item = WishlistItem::factory()->create();
        $this->expectException(UniqueConstraintViolationException::class);
        WishlistItem::factory()->create(['user_id' => $item->user_id, 'product_id' => $item->product_id]);
    }

    public function test_foreign_keys_remove_orphaned_wishlist_entries(): void
    {
        $item = WishlistItem::factory()->create();
        $item->product->delete();
        $this->assertDatabaseCount('wishlist_items', 0);
        $other = WishlistItem::factory()->create();
        $other->user->delete();
        $this->assertDatabaseCount('wishlist_items', 0);
    }
}
