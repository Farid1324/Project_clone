<?php

namespace Tests\Feature;

use App\Models\DigitalKey;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Models\WishlistItem;
use Database\Seeders\DemoMarketplaceSeeder;
use Database\Seeders\ProductArtworkSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProductArtworkTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_seeded_listing_has_a_manifested_local_portrait_cover_with_provenance(): void
    {
        $this->seed(DemoMarketplaceSeeder::class);
        $manifest = json_decode(file_get_contents(database_path('seeders/data/cover-artwork.json')), true, 512, JSON_THROW_ON_ERROR);
        $this->assertCount(44, $manifest['assets']);
        $paths = [];
        $slugs = [];
        foreach ($manifest['assets'] as $asset) {
            $file = public_path(ltrim($asset['path'], '/'));
            $this->assertFileExists($file);
            $dimensions = getimagesize($file);
            $this->assertSame([600, 900, IMAGETYPE_WEBP], array_slice($dimensions, 0, 3));
            $this->assertSame($asset['sha256'], hash_file('sha256', $file));
            $this->assertNotEmpty($asset['source_pages']);
            $this->assertNotEmpty($asset['source_image_urls']);
            foreach (array_merge($asset['source_pages'], $asset['source_image_urls']) as $url) {
                $this->assertSame('https', parse_url($url, PHP_URL_SCHEME));
            }
            foreach ($asset['product_slugs'] as $slug) {
                $slugs[] = $slug;
                $this->assertSame($asset['path'], Product::where('slug', $slug)->firstOrFail()->cover_image_path);
            }
            $paths[] = $asset['path'];
        }
        $this->assertCount(45, $slugs);
        $this->assertCount(45, array_unique($slugs));
        $this->assertCount(44, array_unique($paths));
        $this->getJson('/api/v1/products?per_page=48&in_stock=false')->assertOk()->assertJsonCount(45, 'data');
    }

    public function test_cover_backfill_preserves_accounts_inventory_purchases_and_metadata_and_is_repeatable(): void
    {
        $this->seed(DemoMarketplaceSeeder::class);
        $user = User::factory()->create();
        $product = Product::firstOrFail();
        WishlistItem::factory()->for($user)->for($product)->create();
        $product->update(['is_active' => false, 'description' => 'Preserve editorial content and publication state.']);
        $product->offers()->firstOrFail()->update(['price_minor' => 5555, 'comparison_price_minor' => 6000]);
        Product::query()->update(['cover_image_path' => '/demo/cover-unavailable.svg']);
        $tables = ['users', 'offers', 'digital_keys', 'carts', 'cart_items', 'orders', 'order_items', 'payment_attempts', 'wishlist_items'];
        $before = [];
        foreach ($tables as $table) {
            $before[$table] = $this->fingerprint($table);
        }
        $metadata = $this->productMetadata();
        $this->assertGreaterThan(0, DigitalKey::whereNotNull('allocated_at')->count());
        $this->assertGreaterThan(0, Order::count());
        $this->seed(ProductArtworkSeeder::class);
        foreach ($tables as $table) {
            $this->assertSame($before[$table], $this->fingerprint($table), $table.' must remain unchanged.');
        }
        $this->assertSame($metadata, $this->productMetadata());
        $this->assertSame(0, Product::where('cover_image_path', '/demo/cover-unavailable.svg')->count());
        $after = $this->fingerprint('products');
        $this->seed(ProductArtworkSeeder::class);
        $this->assertSame($after, $this->fingerprint('products'));
    }

    public function test_cover_backfill_does_not_create_products_accounts_or_inventory_in_an_empty_database(): void
    {
        $this->seed(ProductArtworkSeeder::class);
        foreach (['users', 'products', 'offers', 'digital_keys', 'orders', 'wishlist_items'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }
    }

    private function fingerprint(string $table): string
    {
        return hash('sha256', DB::table($table)->orderBy('id')->get()->toJson());
    }

    private function productMetadata(): string
    {
        return hash('sha256', DB::table('products')->orderBy('id')->get()->map(fn (object $row): array => array_diff_key((array) $row, array_flip(['cover_image_path', 'updated_at'])))->toJson());
    }
}
