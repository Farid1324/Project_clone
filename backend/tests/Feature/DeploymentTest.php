<?php

namespace Tests\Feature;

use App\Models\DigitalKey;
use App\Models\Offer;
use App\Models\Product;
use Database\Seeders\DemoMarketplaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeploymentTest extends TestCase
{
    use RefreshDatabase;

    private function frontend(): void
    {
        $index = tempnam(sys_get_temp_dir(), 'keymarket-spa-');
        file_put_contents($index, '<!doctype html><html><body><div id="root">Compiled marketplace</div></body></html>');
        config(['marketplace.spa_index' => $index]);
        $this->beforeApplicationDestroyed(fn (): bool => unlink($index));
    }

    public function test_compiled_spa_supports_root_and_deep_links_without_intercepting_api_or_asset_errors(): void
    {
        $this->frontend();
        foreach (['/', '/store?q=elden', '/products/demo-title', '/login', '/cart', '/checkout', '/orders/demo-id'] as $path) {
            $response = $this->get($path)->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
            $this->assertSame('no-cache, private', $response->headers->get('Cache-Control'));
            $this->assertSame(200, $response->getStatusCode());
        }
        foreach (['/api/v1/missing', '/sanctum/missing', '/assets/missing.js', '/demo/missing.svg', '/.env', '/missing.php'] as $path) {
            $this->get($path)->assertNotFound();
        }
        $this->getJson('/api/v1/products')->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_missing_frontend_build_keeps_api_root_available_and_reports_unbuilt_pages(): void
    {
        config(['marketplace.spa_index' => storage_path('framework/missing-build.html')]);
        $this->get('/')->assertOk()->assertJsonPath('service', 'Keymarket API');
        $this->get('/store')->assertServiceUnavailable();
    }

    public function test_trusted_proxy_generates_https_artwork_and_secure_session_cookies(): void
    {
        config(['trustedproxy.proxies' => ['127.0.0.1'], 'session.secure' => true]);
        $product = Product::factory()->create();
        $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])->withHeaders(['X-Forwarded-Proto' => 'https', 'X-Forwarded-Host' => 'keymarket.example', 'X-Forwarded-Port' => '443']);
        $r = $this->getJson('/api/v1/products/'.$product->slug)->assertOk();
        $this->assertStringStartsWith('https://keymarket.example/', $r->json('data.cover_image_url'));
        $cart = $this->getJson('/api/v1/cart')->assertOk();
        $cookie = $cart->getCookie(config('session.cookie'));
        $this->assertTrue($cookie->isSecure());
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertSame('lax', $cookie->getSameSite());
    }

    public function test_untrusted_proxy_headers_do_not_change_generated_artwork_origin(): void
    {
        config(['trustedproxy.proxies' => []]);
        $product = Product::factory()->create();
        $r = $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.10'])->withHeaders(['X-Forwarded-Proto' => 'https', 'X-Forwarded-Host' => 'untrusted.example'])->getJson('/api/v1/products/'.$product->slug)->assertOk();
        $this->assertSame('http', parse_url($r->json('data.cover_image_url'), PHP_URL_SCHEME));
        $this->assertSame('localhost', parse_url($r->json('data.cover_image_url'), PHP_URL_HOST));
    }

    public function test_deploy_refuses_missing_secrets_and_non_https_production_url(): void
    {
        config(['app.key' => '']);
        $this->artisan('marketplace:deploy')->assertFailed();
        config(['app.key' => 'base64:'.base64_encode(random_bytes(32)), 'app.url' => 'http://insecure.example']);
        $this->app->detectEnvironment(fn (): string => 'production');
        $this->artisan('marketplace:deploy')->assertFailed();
        $this->assertSame(0, Product::count());
    }

    public function test_production_seeder_is_disabled_without_explicit_demo_opt_in(): void
    {
        config(['marketplace.allow_demo_seeding' => false]);
        $this->app->detectEnvironment(fn (): string => 'production');
        $this->expectException(\LogicException::class);
        app(DemoMarketplaceSeeder::class)->run();
    }

    public function test_first_boot_can_seed_an_explicit_production_demo_and_restarts_preserve_changes(): void
    {
        config(['app.url' => 'https://keymarket.example', 'marketplace.allow_demo_seeding' => true, 'marketplace.seed_demo_on_first_boot' => true]);
        $this->app->detectEnvironment(fn (): string => 'production');
        $this->artisan('marketplace:deploy')->assertSuccessful();
        $this->assertSame(45, Product::count());
        $this->assertSame(135, Offer::count());
        $product = Product::firstOrFail();
        $product->update(['description' => 'A preserved manual description.']);
        DigitalKey::available()->firstOrFail()->update(['retired_at' => now()]);
        $stock = DigitalKey::available()->count();
        $this->artisan('marketplace:deploy')->assertSuccessful();
        $this->assertSame('A preserved manual description.', $product->fresh()->description);
        $this->assertSame($stock, DigitalKey::available()->count());
    }

    public function test_first_boot_cannot_seed_without_explicit_permission(): void
    {
        config(['marketplace.allow_demo_seeding' => false, 'marketplace.seed_demo_on_first_boot' => true]);
        $this->artisan('marketplace:deploy')->assertFailed();
        $this->assertSame(0, Product::count());
    }
}
