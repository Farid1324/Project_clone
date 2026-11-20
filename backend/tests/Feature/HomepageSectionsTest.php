<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\DigitalKey;
use App\Models\Offer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PaymentAttempt;
use App\Models\Product;
use App\Models\Seller;
use App\Services\Home\BannerService;
use Database\Seeders\DemoMarketplaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Mockery\MockInterface;
use Tests\TestCase;

class HomepageSectionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_best_selling_games_excludes_gift_cards_even_when_they_have_more_sales(): void
    {
        $game = Offer::factory()->inStock()->create();
        $gift = Offer::factory()->for(Product::factory()->create(['type' => 'gift_card']))->inStock()->create();
        $this->sale($game, 2);
        $this->sale($gift, 9);

        $this->getJson('/api/v1/home/best-sellers')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $game->product_id)->assertJsonPath('data.0.type', 'game');
    }

    public function test_popular_categories_rank_eligible_products_by_sales_and_exclude_empty_or_hidden_stock(): void
    {
        $popular = Category::factory()->create(['name' => 'Popular']);
        $larger = Category::factory()->create(['name' => 'Larger']);
        Category::factory()->create();
        $first = Offer::factory()->inStock()->create();
        $second = Offer::factory()->inStock()->create();
        $extra = Offer::factory()->inStock()->create();
        $soldOut = Offer::factory()->create();
        $hidden = Offer::factory()->for(Product::factory()->create(['is_active' => false]))->inStock()->create();
        $first->product->categories()->attach($popular);
        foreach ([$second, $extra, $soldOut, $hidden] as $offer) {
            $offer->product->categories()->attach($larger);
        }
        $this->sale($first, 4);
        $this->sale($second, 2);
        $this->sale($soldOut, 9);
        $this->sale($hidden, 9);

        $this->getJson('/api/v1/home/categories')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $popular->id)->assertJsonPath('data.0.products_count', 1)
            ->assertJsonPath('data.1.id', $larger->id)->assertJsonPath('data.1.products_count', 2);
        $popular->update(['name' => 'Changed in the database']);
        $this->getJson('/api/v1/home/categories')->assertOk()->assertJsonPath('data.0.name', 'Changed in the database');
        $this->sale($extra, 4);
        $this->getJson('/api/v1/home/categories')->assertOk()->assertJsonPath('data.0.id', $larger->id);
    }

    public function test_popular_categories_without_sales_fall_back_to_available_product_count_then_name(): void
    {
        $large = Category::factory()->create(['name' => 'Z large']);
        $alpha = Category::factory()->create(['name' => 'A single']);
        $beta = Category::factory()->create(['name' => 'B single']);
        foreach ([$large, $large, $alpha, $beta] as $category) {
            $offer = Offer::factory()->inStock()->create();
            $offer->product->categories()->attach($category);
        }

        $this->getJson('/api/v1/home/categories')->assertOk()->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.id', $large->id)->assertJsonPath('data.1.id', $alpha->id)
            ->assertJsonPath('data.2.id', $beta->id);
    }

    public function test_gift_cards_rank_recent_fulfilled_quantities_across_seller_offers(): void
    {
        $first = Product::factory()->create(['type' => 'gift_card']);
        $one = Offer::factory()->for($first)->inStock()->create(['price_minor' => 2000]);
        $two = Offer::factory()->for($first)->inStock()->create(['price_minor' => 2500]);
        $other = Offer::factory()->for(Product::factory()->create(['type' => 'gift_card']))->inStock()->create(['price_minor' => 1000]);
        $this->sale($one, 2);
        $this->sale($two, 3);
        $this->sale($other, 4);
        $this->sale($other, 9, 'payment_failed');
        $this->sale($other, 9, 'fulfilled', now()->subDays(31));
        $this->sale($other, 9, 'fulfilled', now()->addDay());
        $game = Offer::factory()->inStock()->create();
        $this->sale($game, 9);

        $this->getJson('/api/v1/home/gift-cards')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $first->id)->assertJsonPath('data.0.price_minor', 2000)
            ->assertJsonPath('data.1.id', $other->product_id);
        $one->update(['price_minor' => 1800]);
        $this->getJson('/api/v1/home/gift-cards')->assertOk()->assertJsonPath('data.0.price_minor', 1800);
    }

    public function test_gift_cards_exclude_unpublished_inactive_suspended_and_sold_out_offers(): void
    {
        $valid = Offer::factory()->for(Product::factory()->create(['type' => 'gift_card']))->inStock()->create();
        Offer::factory()->for(Product::factory()->create(['type' => 'gift_card']))->create();
        Offer::factory()->for(Product::factory()->create(['type' => 'gift_card', 'is_active' => false]))->inStock()->create();
        Offer::factory()->for(Product::factory()->create(['type' => 'gift_card']))->inStock()->create(['is_active' => false]);
        Offer::factory()->for(Product::factory()->create(['type' => 'gift_card']))
            ->for(Seller::factory()->create(['status' => 'suspended']))->inStock()->create();

        $this->getJson('/api/v1/home/gift-cards')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $valid->product_id);
        $valid->digitalKeys()->update(['retired_at' => now()]);
        $this->getJson('/api/v1/home/gift-cards')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_unsold_gift_cards_use_current_price_and_id_for_a_stable_fallback(): void
    {
        $cheaper = Offer::factory()->for(Product::factory()->create(['type' => 'gift_card']))->inStock()->create(['price_minor' => 1000]);
        $dearer = Offer::factory()->for(Product::factory()->create(['type' => 'gift_card']))->inStock()->create(['price_minor' => 2000]);

        $this->getJson('/api/v1/home/gift-cards')->assertOk()->assertJsonPath('data.0.id', $cheaper->product_id)
            ->assertJsonPath('data.1.id', $dearer->product_id);
    }

    public function test_recommendations_use_only_available_seller_ratings_and_offer_depth_then_release_date(): void
    {
        $best = Product::factory()->create(['release_date' => '2020-01-01']);
        $second = Product::factory()->create(['release_date' => '2026-01-01']);
        $third = Product::factory()->create(['release_date' => '2025-01-01']);
        $lower = Product::factory()->create(['release_date' => '2026-11-01']);
        foreach ([$best, $second, $third] as $product) {
            Offer::factory()->for($product)->for(Seller::factory()->create(['rating' => 4.8]))->inStock()->create();
        }
        Offer::factory()->for($best)->for(Seller::factory()->create(['rating' => 4.5]))->inStock()->create();
        $low = Offer::factory()->for($lower)->for(Seller::factory()->create(['rating' => 4.2]))->inStock()->create(['price_minor' => 1200]);
        Offer::factory()->for($lower)->for(Seller::factory()->create(['rating' => 5]))->create(['price_minor' => 100]);
        Offer::factory()->for($lower)->for(Seller::factory()->create(['rating' => 5, 'status' => 'suspended']))->inStock()->create();
        Offer::factory()->for($lower)->for(Seller::factory()->create(['rating' => 5]))->inStock()->create(['is_active' => false]);
        Offer::factory()->for(Product::factory()->create(['is_active' => false]))->inStock()->create();
        Offer::factory()->create();

        $this->getJson('/api/v1/home/recommendations')->assertOk()->assertJsonCount(4, 'data')
            ->assertJsonPath('data.0.id', $best->id)->assertJsonPath('data.1.id', $second->id)
            ->assertJsonPath('data.2.id', $third->id)->assertJsonPath('data.3.id', $lower->id)
            ->assertJsonPath('data.3.price_minor', 1200)->assertJsonPath('data.3.available_offer_count', 1);
        $low->seller->update(['rating' => 4.9]);
        $this->getJson('/api/v1/home/recommendations')->assertOk()->assertJsonPath('data.0.id', $lower->id);
    }

    public function test_cold_start_recommendations_are_bounded_unique_and_stable(): void
    {
        $this->travelTo(Carbon::parse('2026-11-19 12:00:00', 'UTC'));
        Offer::factory()->count(14)->inStock()->create();
        $first = $this->getJson('/api/v1/home/recommendations')->assertOk()->assertJsonCount(12, 'data')->json('data');
        $ids = array_column($first, 'id');
        $this->assertCount(12, array_unique($ids));
        $this->assertSame($ids, array_column($this->getJson('/api/v1/home/recommendations')->assertOk()->json('data'), 'id'));
    }

    public function test_all_six_sections_return_empty_arrays_when_no_eligible_data_exists(): void
    {
        $product = Product::factory()->create();
        $product->categories()->attach(Category::factory()->create());
        Offer::factory()->for($product)->create();

        foreach (['banners', 'categories', 'best-sellers', 'deals', 'gift-cards', 'recommendations'] as $section) {
            $this->getJson('/api/v1/home/'.$section)->assertOk()->assertExactJson(['data' => []]);
        }
    }

    public function test_one_failing_provider_does_not_break_other_section_endpoints(): void
    {
        $this->seed(DemoMarketplaceSeeder::class);
        $this->mock(BannerService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')->once()->andThrow(new \RuntimeException('Private failure details'));
        });

        $this->getJson('/api/v1/home/banners')->assertStatus(500)
            ->assertJsonPath('error.code', 'internal_error')->assertDontSee('Private failure details');
        foreach (['categories', 'best-sellers', 'deals', 'gift-cards', 'recommendations'] as $section) {
            $response = $this->getJson('/api/v1/home/'.$section)->assertOk();
            $this->assertNotEmpty($response->json('data'));
        }
    }

    private function sale(Offer $offer, int $quantity, string $status = 'fulfilled', ?Carbon $fulfilledAt = null): void
    {
        $fulfilledAt = $status === 'fulfilled' ? ($fulfilledAt ?? now()->subDay()) : null;
        $order = Order::factory()->create(['status' => $status, 'fulfilled_at' => $fulfilledAt, 'created_at' => $fulfilledAt ?? now(), 'total_minor' => $offer->price_minor * $quantity]);
        $item = OrderItem::factory()->for($order)->for($offer)->create(['quantity' => $quantity, 'unit_price_minor' => $offer->price_minor]);
        PaymentAttempt::factory()->for($order)->create(['scenario' => $status === 'fulfilled' ? 'approve' : 'decline', 'status' => $status === 'fulfilled' ? 'approved' : 'declined', 'amount_minor' => $order->total_minor]);
        if ($status === 'fulfilled') {
            DigitalKey::factory()->count($quantity)->for($offer)->create(['order_item_id' => $item->id, 'allocated_at' => $fulfilledAt]);
        }
    }
}
