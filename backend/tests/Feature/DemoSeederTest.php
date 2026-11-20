<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\DigitalKey;
use App\Models\HomepageBanner;
use App\Models\Offer;
use App\Models\Order;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\User;
use Database\Seeders\DemoMarketplaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_seed_is_repeatable_and_has_realistic_connected_inventory(): void
    {
        $this->seed(DemoMarketplaceSeeder::class);
        $counts = $this->counts();
        $stock = DigitalKey::query()->available()->count();
        $fixturePassword = User::where('email', 'demo@keymarket.test')->firstOrFail()->password;
        $this->assertSame(45, Product::count());
        $this->assertSame(135, Offer::count());
        $this->assertSame(8, Product::where('type', 'gift_card')->count());
        $this->assertSame(25, Product::whereHas('platform', fn ($query) => $query->where('slug', 'steam'))->where('type', 'game')->count());
        $this->assertSame(12, Product::whereHas('platform', fn ($query) => $query->whereIn('slug', ['xbox', 'nintendo']))->where('type', 'game')->count());
        foreach (Product::with(['categories', 'offers.seller'])->get() as $product) {
            $this->assertCount(3, $product->offers);
            $this->assertNotEmpty($product->categories);
            $this->assertSame(3, $product->offers->pluck('seller_id')->unique()->count());
            $this->assertFileExists(public_path(ltrim($product->cover_image_path, '/')));
        }
        foreach (Order::with(['items.digitalKeys', 'paymentAttempt'])->get() as $order) {
            $this->assertTrue($order->created_at->lessThanOrEqualTo($order->fulfilled_at));
            $this->assertSame($order->total_minor, $order->items->sum('line_total_minor'));
            $this->assertSame($order->total_minor, $order->paymentAttempt->amount_minor);
            $this->assertSame('approved', $order->paymentAttempt->status);
            foreach ($order->items as $item) {
                $this->assertSame($item->quantity, $item->digitalKeys->count());
            }
        }
        $this->seed(DemoMarketplaceSeeder::class);
        $this->assertNotSame($fixturePassword, User::where('email', 'demo@keymarket.test')->firstOrFail()->password);
        $this->assertSame(1, User::where('email', 'demo@keymarket.test')->count());
        $this->assertSame($counts, $this->counts());
        $this->assertSame($stock, DigitalKey::query()->available()->count());
        $this->getJson('/api/v1/products')->assertOk()->assertJsonPath('meta.total', 45);
        $this->getJson('/api/v1/products?regions[]=US')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.region.code', 'US');
        $this->getJson('/api/v1/home/banners')->assertOk()->assertJsonCount(3, 'data');
        $this->getJson('/api/v1/home/categories')->assertOk()->assertJsonCount(9, 'data');
        $this->getJson('/api/v1/home/best-sellers')->assertOk()->assertJsonCount(12, 'data');
        $this->getJson('/api/v1/home/deals')->assertOk()->assertJsonCount(12, 'data');
        $this->getJson('/api/v1/home/gift-cards')->assertOk()->assertJsonCount(8, 'data');
        $this->getJson('/api/v1/home/recommendations')->assertOk()->assertJsonCount(12, 'data');
        $this->assertSame(4, Order::whereHas('items.offer.product', fn ($query) => $query->where('type', 'gift_card'))->count());
        $this->getJson('/api/v1/home/promotions')->assertOk()->assertJsonPath('meta.total', 2);
    }

    private function counts(): array
    {
        return [Product::count(), Offer::count(), DigitalKey::count(), Order::count(), Cart::count(), Promotion::count(), HomepageBanner::count()];
    }
}
