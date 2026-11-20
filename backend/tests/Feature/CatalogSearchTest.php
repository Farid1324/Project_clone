<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\DigitalKey;
use App\Models\Offer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PaymentAttempt;
use App\Models\Platform;
use App\Models\Product;
use App\Models\Region;
use App\Models\Seller;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CatalogSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_combined_search_platform_region_category_and_price_filters_match_one_offer(): void
    {
        $steam = Platform::factory()->create(['slug' => 'steam']);
        $xbox = Platform::factory()->create(['slug' => 'xbox']);
        $europe = Region::factory()->create(['code' => 'EU']);
        $us = Region::factory()->create(['code' => 'US']);
        $rpg = Category::factory()->create(['slug' => 'rpg']);
        $otherCategory = Category::factory()->create();
        $listing = function (array $attributes = [], array $prices = [2200], bool $available = true) use ($steam, $europe, $rpg): Product {
            $product = Product::factory()->hasAttached($rpg)->create(array_merge(['title' => 'Elden Ring', 'platform_id' => $steam->id, 'region_id' => $europe->id], $attributes));
            foreach ($prices as $price) {
                $factory = Offer::factory()->for($product);
                if ($available) {
                    $factory = $factory->inStock();
                }
                $factory->create(['price_minor' => $price, 'comparison_price_minor' => 5999]);
            }

            return $product;
        };
        $winner = $listing([], [500, 2200, 2500]);
        $listing(['title' => 'Cities Skylines']);
        $listing(['platform_id' => $xbox->id]);
        $listing(['region_id' => $us->id]);
        $wrongCategory = $listing();
        $wrongCategory->categories()->sync([$otherCategory->id]);
        $listing([], [500, 4000]);
        $listing([], [2200], false);
        $listing(['is_active' => false]);
        $query = http_build_query(['q' => 'ELDN RING', 'platforms' => ['steam'], 'regions' => ['EU'], 'categories' => ['rpg'], 'price_min' => 2000, 'price_max' => 3000, 'sort' => 'price_asc']);

        $this->getJson('/api/v1/products?'.$query)->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $winner->id)->assertJsonPath('data.0.price_minor', 2200)
            ->assertJsonPath('data.0.available_offer_count', 2);
    }

    public function test_values_within_a_facet_are_or_and_different_facets_are_and_without_duplicates(): void
    {
        $steam = Platform::factory()->create(['slug' => 'steam']);
        $xbox = Platform::factory()->create(['slug' => 'xbox']);
        $europe = Region::factory()->create(['code' => 'EU']);
        $us = Region::factory()->create(['code' => 'US']);
        $first = Category::factory()->create();
        $second = Category::factory()->create();
        $both = Product::factory()->for($steam)->for($europe)->hasAttached($first)->hasAttached($second)->create();
        $other = Product::factory()->for($xbox)->for($us)->hasAttached($second)->create();
        $this->stocked($both, 1000);
        $this->stocked($both, 1100);
        $this->stocked($other, 1000);
        $outside = Product::factory()->hasAttached($first)->create();
        $this->stocked($outside, 1000);
        $query = http_build_query(['categories' => [$first->slug, $second->slug], 'platforms' => ['steam', 'xbox'], 'regions' => ['EU', 'US'], 'per_page' => 1, 'sort' => 'price_asc']);
        $pageOne = $this->getJson('/api/v1/products?'.$query)->assertOk()->assertJsonPath('meta.total', 2)->assertJsonPath('meta.last_page', 2);
        $pageTwo = $this->getJson('/api/v1/products?'.$query.'&page=2')->assertOk();
        $this->assertEqualsCanonicalizing([$both->id, $other->id], [$pageOne->json('data.0.id'), $pageTwo->json('data.0.id')]);
        $this->assertNotSame($pageOne->json('data.0.id'), $pageTwo->json('data.0.id'));
    }

    #[DataProvider('stableSorts')]
    public function test_sorting_and_pagination_have_complete_unique_stable_results(string $sort): void
    {
        $this->travelTo(Carbon::parse('2026-11-19 12:00:00', 'UTC'));
        $rows = [];
        foreach ([2000, 1000, 1000, 3000] as $index => $price) {
            $product = Product::factory()->create(['created_at' => now()->subDays(4 - $index)]);
            $this->stocked($product, $price);
            $this->stocked($product, $price + 100);
            $rows[] = ['id' => $product->id, 'price' => $price, 'date' => $product->created_at->timestamp];
        }
        usort($rows, static function (array $a, array $b) use ($sort): int {
            $difference = match ($sort) {
                'price_asc' => $a['price'] <=> $b['price'],
                'price_desc' => $b['price'] <=> $a['price'],
                default => $b['date'] <=> $a['date'],
            };

            return $difference ?: strcmp($a['id'], $b['id']);
        });
        $expected = array_column($rows, 'id');
        $first = $this->getJson('/api/v1/products?sort='.$sort.'&per_page=2')->assertOk()
            ->assertJsonPath('meta.total', 4)->assertJsonPath('meta.last_page', 2);
        $nextUrl = $first->json('links.next');
        $this->assertStringContainsString('sort='.$sort, $nextUrl);
        $second = $this->getJson($nextUrl)->assertOk()->assertJsonPath('meta.current_page', 2);
        $actual = array_merge(array_column($first->json('data'), 'id'), array_column($second->json('data'), 'id'));
        $this->assertSame($expected, $actual);
        $this->assertCount(4, array_unique($actual));
        $this->assertSame($first->json('data'), $this->getJson('/api/v1/products?sort='.$sort.'&per_page=2')->assertOk()->json('data'));
        $this->getJson('/api/v1/products?sort='.$sort.'&per_page=2&page=3')->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.total', 4);
    }

    public static function stableSorts(): array
    {
        return [['price_asc'], ['price_desc'], ['newest']];
    }

    public function test_popularity_sums_recent_fulfilled_units_across_sellers_and_keeps_unsold_products(): void
    {
        $first = Product::factory()->create(['created_at' => now()->subDays(5)]);
        $second = Product::factory()->create(['created_at' => now()->subDays(4)]);
        $unsold = Product::factory()->create(['created_at' => now()->subDay()]);
        $one = $this->stocked($first, 2000);
        $two = $this->stocked($first, 2500);
        $competitor = $this->stocked($second, 1000);
        $this->stocked($unsold, 500);
        $this->sale($one, 3);
        $this->sale($two, 3);
        $this->sale($competitor, 5);
        $this->sale($competitor, 9, 'payment_failed');
        $this->sale($competitor, 9, 'fulfilled', now()->subDays(31));
        $this->sale($competitor, 9, 'fulfilled', now()->addDay());
        $soldOut = Offer::factory()->create();
        $this->sale($soldOut, 9);

        $response = $this->getJson('/api/v1/products?sort=popularity&per_page=1')->assertOk()->assertJsonPath('meta.total', 3)
            ->assertJsonPath('data.0.id', $first->id)->assertJsonPath('data.0.price_minor', 2000);
        $this->getJson($response->json('links.next'))->assertOk()->assertJsonPath('data.0.id', $second->id);
        $this->getJson('/api/v1/products?sort=popularity&per_page=1&page=3')->assertOk()->assertJsonPath('data.0.id', $unsold->id);
        $this->getJson('/api/v1/products?sort=popularity&price_max=1500')->assertOk()->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.id', $second->id);
    }

    public function test_popularity_ties_use_newest_then_id_and_remain_compatible_with_search_and_facets(): void
    {
        $this->travelTo(Carbon::parse('2026-11-19 12:00:00', 'UTC'));
        $platform = Platform::factory()->create(['slug' => 'steam']);
        $older = Product::factory()->for($platform)->create(['title' => 'Elden Ring', 'created_at' => now()->subDay()]);
        $newer = Product::factory()->for($platform)->create(['title' => 'Elden Ring Deluxe']);
        $other = Product::factory()->create(['title' => 'Portal 2']);
        $this->stocked($older, 2000);
        $this->stocked($newer, 2000);
        $this->stocked($other, 2000);

        $this->getJson('/api/v1/products?q=elden&platforms[]=steam&sort=popularity')->assertOk()->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.id', $newer->id)->assertJsonPath('data.1.id', $older->id);
    }

    public function test_exact_prefix_substring_and_fuzzy_results_share_relevance_order_with_autocomplete(): void
    {
        $expected = [];
        foreach (['Elden Ring', 'Elden Ring Deluxe', 'The Elden Ring Collection', 'Eldn Ring'] as $title) {
            $product = Product::factory()->create(['title' => $title]);
            $this->stocked($product, 2000);
            $expected[] = $product->id;
        }
        $this->stocked(Product::factory()->create(['title' => 'Cities Skylines']), 2000);
        $products = $this->getJson('/api/v1/products?q=ELDEN%20RING')->assertOk()->assertJsonPath('meta.total', 4);
        $suggestions = $this->getJson('/api/v1/search/suggestions?q=ELDEN%20RING')->assertOk()->assertJsonCount(4, 'data');
        $this->assertSame($expected, array_column($products->json('data'), 'id'));
        $this->assertSame($expected, array_column($suggestions->json('data'), 'id'));
        $this->getJson('/api/v1/search/suggestions?q=ELDEN%20RING&limit=1')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $expected[0]);
    }

    public function test_search_restores_connection_similarity_settings_inside_an_existing_transaction(): void
    {
        $product = Product::factory()->create(['title' => 'Minecraft']);
        $this->stocked($product, 2000);
        DB::statement('SET LOCAL pg_trgm.similarity_threshold = 0.95');
        DB::statement('SET LOCAL pg_trgm.word_similarity_threshold = 0.95');

        $this->getJson('/api/v1/products?q=mincraft')->assertOk()->assertJsonPath('data.0.id', $product->id);
        $settings = DB::selectOne("SELECT current_setting('pg_trgm.similarity_threshold') AS similarity, current_setting('pg_trgm.word_similarity_threshold') AS word_similarity");
        $this->assertSame('0.95', $settings->similarity);
        $this->assertSame('0.95', $settings->word_similarity);
    }

    public function test_search_and_suggestions_exclude_hidden_sellers_retired_keys_and_sold_out_products(): void
    {
        $available = Product::factory()->create(['title' => 'Minecraft']);
        $this->stocked($available, 2000);
        $hidden = Product::factory()->create(['title' => 'Minecraft Hidden', 'is_active' => false]);
        $this->stocked($hidden, 2000);
        Offer::factory()->for(Product::factory()->create(['title' => 'Minecraft Suspended']))
            ->for(Seller::factory()->create(['status' => 'suspended']))->inStock()->create();
        Offer::factory()->for(Product::factory()->create(['title' => 'Minecraft Inactive']))->inStock()->create(['is_active' => false]);
        Offer::factory()->for(Product::factory()->create(['title' => 'Minecraft Sold Out']))->create();
        $retired = $this->stocked(Product::factory()->create(['title' => 'Minecraft Retired']), 2000);
        $retired->digitalKeys()->update(['retired_at' => now()]);

        $this->getJson('/api/v1/products?q=minecraf')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $available->id);
        $this->getJson('/api/v1/search/suggestions?q=minecraf')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $available->id);
    }

    public function test_no_matches_and_literal_wildcards_are_empty_without_sql_injection(): void
    {
        $product = Product::factory()->create(['title' => 'Minecraft']);
        $this->stocked($product, 2000);
        foreach (['zzzxxyyqq', '%', '_', '\\', "' OR 1=1 --"] as $term) {
            $this->getJson('/api/v1/products?'.http_build_query(['q' => $term]))->assertOk()->assertJsonPath('meta.total', 0);
        }
        $this->getJson('/api/v1/search/suggestions?q=zzzxxyyqq')->assertOk()->assertExactJson(['data' => []]);
        $this->assertDatabaseHas('products', ['id' => $product->id]);
    }

    public function test_suggestion_length_and_limit_validation_return_standard_errors(): void
    {
        foreach ([['q' => 'x'], ['q' => str_repeat('x', 101)], ['q' => ['array']], ['q' => 'elden', 'limit' => 9], ['q' => 'elden', 'limit' => 0]] as $query) {
            $this->getJson('/api/v1/search/suggestions?'.http_build_query($query))->assertUnprocessable()
                ->assertJsonPath('error.code', 'validation_failed')->assertJsonStructure(['error' => ['fields', 'request_id']]);
        }
    }

    public function test_postgresql_search_extension_and_expression_indexes_are_installed(): void
    {
        $this->assertNotNull(DB::selectOne("SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'"));
        $indexes = collect(DB::select("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'products'"))->keyBy('indexname');
        $this->assertStringContainsString('gin_trgm_ops', $indexes['products_title_trigram']->indexdef);
        $this->assertStringContainsString('lower', $indexes['products_title_trigram']->indexdef);
        $this->assertStringContainsString('text_pattern_ops', $indexes['products_title_prefix']->indexdef);
    }

    private function stocked(Product $product, int $price): Offer
    {
        return Offer::factory()->for($product)->inStock()->create(['price_minor' => $price, 'comparison_price_minor' => max($price, 5999)]);
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
