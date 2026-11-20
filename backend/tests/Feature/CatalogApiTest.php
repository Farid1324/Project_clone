<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\DigitalKey;
use App\Models\Offer;
use App\Models\Platform;
use App\Models\Product;
use App\Models\Seller;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CatalogApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_listing_uses_stocked_active_offers_and_paginates_products_without_duplicates(): void
    {
        $product = Product::factory()->create();
        Offer::factory()->for($product)->create(['price_minor' => 100, 'comparison_price_minor' => 4999]);
        $winner = Offer::factory()->for($product)->inStock(2)->create(['price_minor' => 1999]);
        Offer::factory()->for($product)->inStock()->create(['price_minor' => 2999]);
        Offer::factory()->for($product)->inStock()->create(['price_minor' => 500, 'is_active' => false]);
        Offer::factory()->for($product)->for(Seller::factory()->create(['status' => 'suspended']))->inStock()->create(['price_minor' => 600]);
        DigitalKey::factory()->for($winner)->create(['retired_at' => now()]);
        $response = $this->getJson('/api/v1/products?per_page=1');
        $response->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.price_minor', 1999)->assertJsonPath('data.0.available_offer_count', 2);
        $this->assertStringNotContainsString('key_ciphertext', $response->getContent());
        $this->assertStringNotContainsString('fingerprint', $response->getContent());
    }

    public function test_details_show_independent_sellers_prices_ratings_and_stock(): void
    {
        $product = Product::factory()->create();
        Offer::factory()->for($product)->inStock(2)->create(['price_minor' => 1500]);
        Offer::factory()->for($product)->inStock(4)->create(['price_minor' => 2000]);
        Offer::factory()->for($product)->create(['price_minor' => 1000]);
        $response = $this->getJson('/api/v1/products/'.$product->slug);
        $response->assertOk()->assertJsonCount(3, 'data.offers')->assertJsonPath('data.price_minor', 1500)
            ->assertJsonPath('data.offers.0.stock_available', 0)->assertJsonStructure(['data' => ['activation_notice', 'activation_instructions', 'offers' => [['seller' => ['rating', 'rating_count']]]]]);
        $this->assertStringNotContainsString('DEMO-NOT-REDEEMABLE', $response->getContent());
    }

    #[DataProvider('searchTerms')]
    public function test_partial_and_typo_search_share_store_and_suggestion_results(string $term, string $title = 'Elden Ring'): void
    {
        $elden = Product::factory()->create(['title' => $title]);
        Offer::factory()->for($elden)->inStock()->create();
        $other = Product::factory()->create(['title' => 'Stardew Valley']);
        Offer::factory()->for($other)->inStock()->create();
        $query = http_build_query(['q' => $term]);
        $this->getJson('/api/v1/products?'.$query)->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $elden->id);
        $this->getJson('/api/v1/search/suggestions?'.$query)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $elden->id);
    }

    public static function searchTerms(): array
    {
        return [['elden'], ['eldn ring'], ['ELDEN RING'], ['ring'], ['minecraf', 'Minecraft'], ['mincraft', 'Minecraft'], ['MINECRAF', 'Minecraft'], ['wicher', 'The Witcher 3: Wild Hunt'], ['cyberpnk', 'Cyberpunk 2077']];
    }

    public function test_like_wildcards_are_literal_and_not_a_match_all_search(): void
    {
        Offer::factory()->inStock()->create();
        $this->getJson('/api/v1/products?q=%25')->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_facets_sorting_and_price_bounds_apply_to_a_single_available_offer(): void
    {
        $category = Category::factory()->create();
        $platform = Platform::factory()->create();
        $product = Product::factory()->for($platform)->hasAttached($category)->create();
        Offer::factory()->for($product)->inStock()->create(['price_minor' => 500]);
        Offer::factory()->for($product)->inStock()->create(['price_minor' => 3000, 'comparison_price_minor' => 3999]);
        Offer::factory()->for($product)->create(['price_minor' => 1500]);
        $query = http_build_query(['categories' => [$category->slug], 'platforms' => [$platform->slug], 'price_min' => 1000, 'price_max' => 2000]);
        $this->getJson('/api/v1/products?'.$query)->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/products?'.http_build_query(['platforms' => [$platform->slug], 'price_min' => 2000, 'sort' => 'price_desc']))
            ->assertOk()->assertJsonPath('data.0.price_minor', 3000);
    }

    public function test_price_sort_and_pagination_are_stable(): void
    {
        foreach ([1000, 500, 2000] as $price) {
            Offer::factory()->inStock()->create(['price_minor' => $price]);
        }
        $this->getJson('/api/v1/products?sort=price_asc&per_page=1&page=2')->assertOk()
            ->assertJsonPath('meta.total', 3)->assertJsonPath('meta.last_page', 3)->assertJsonPath('data.0.price_minor', 1000);
    }

    public function test_sold_out_products_are_opt_in_with_null_prices(): void
    {
        Offer::factory()->create();
        $this->getJson('/api/v1/products')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/products?in_stock=false')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.price_minor', null)->assertJsonPath('data.0.is_available', false);
    }

    #[DataProvider('invalidQueries')]
    public function test_bad_filters_receive_consistent_validation_errors(array $query): void
    {
        $response = $this->getJson('/api/v1/products?'.http_build_query($query));
        $response->assertUnprocessable()->assertJsonPath('error.code', 'validation_failed')->assertJsonStructure(['error' => ['fields', 'request_id']])->assertHeader('X-Request-ID');
        $this->assertStringNotContainsString('SQLSTATE', $response->getContent());
    }

    public static function invalidQueries(): array
    {
        return [[['per_page' => 49]], [['sort' => 'price;drop table products']], [['regions' => ['UNKNOWN']]],
            [['price_min' => -1]], [['price_min' => 2000, 'price_max' => 1000]], [['q' => ['invalid']]],
            [['platforms' => 'steam']], [['unexpected' => 'value']]];
    }

    public function test_categories_and_filters_are_backend_driven(): void
    {
        $category = Category::factory()->create();
        Product::factory()->hasAttached($category)->create();
        Product::factory()->hasAttached($category)->create(['is_active' => false]);
        $this->getJson('/api/v1/categories?per_page=1')->assertOk()->assertJsonPath('data.0.products_count', 1)->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/categories/'.$category->slug)->assertOk()->assertJsonPath('data.slug', $category->slug);
        $this->getJson('/api/v1/catalog/filters')->assertOk()->assertJsonCount(1, 'data.categories')->assertJsonCount(2, 'data.platforms');
    }

    public function test_offers_filter_by_product_and_include_ratings_without_keys(): void
    {
        $offer = Offer::factory()->inStock(2)->create();
        Offer::factory()->for($offer->product)->create();
        $this->getJson('/api/v1/offers?product_id='.$offer->product_id)->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.stock_available', 2);
        $this->getJson('/api/v1/offers?product_id='.$offer->product_id.'&in_stock=false')->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson('/api/v1/offers/'.$offer->id)->assertOk()->assertJsonStructure(['data' => ['seller' => ['rating', 'rating_count']]]);
        $this->getJson('/api/v1/offers/not-a-uuid')->assertNotFound()->assertJsonPath('error.code', 'not_found');
        $this->getJson('/api/v1/digital-keys')->assertNotFound();
    }

    public function test_inactive_and_unknown_products_are_not_public(): void
    {
        $product = Product::factory()->create(['is_active' => false]);
        $this->getJson('/api/v1/products/'.$product->slug)->assertNotFound()->assertJsonPath('error.code', 'not_found');
        $this->getJson('/api/v1/products/missing')->assertNotFound();
    }

    public function test_health_checks_the_database(): void
    {
        $this->getJson('/api/v1/health')->assertOk()->assertJsonPath('data.status', 'ready');
    }
}
