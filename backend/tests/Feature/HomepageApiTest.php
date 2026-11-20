<?php

namespace Tests\Feature;

use App\Models\DigitalKey;
use App\Models\HomepageBanner;
use App\Models\Offer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PaymentAttempt;
use App\Models\Product;
use App\Models\Promotion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class HomepageApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_banner_windows_order_and_product_visibility(): void
    {
        $this->travelTo(Carbon::parse('2026-11-19 12:00:00', 'UTC'));
        $product = Product::factory()->create();
        $first = HomepageBanner::factory()->create(['title' => 'First', 'sort_order' => 1, 'starts_at' => now(), 'ends_at' => now()->addHour()]);
        HomepageBanner::factory()->create(['title' => 'Second', 'sort_order' => 2, 'destination_type' => 'product', 'product_id' => $product->id]);
        HomepageBanner::factory()->create(['starts_at' => now()->addMinute()]);
        HomepageBanner::factory()->create(['ends_at' => now(), 'starts_at' => now()->subDay()]);
        HomepageBanner::factory()->create(['is_active' => false]);
        HomepageBanner::factory()->create(['destination_type' => 'product', 'product_id' => Product::factory()->create(['is_active' => false])->id]);
        $this->getJson('/api/v1/home/banners')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $first->id)->assertJsonPath('data.1.destination.product_slug', $product->slug);
        $first->update(['title' => 'Changed in PostgreSQL']);
        $this->getJson('/api/v1/home/banners')->assertOk()->assertJsonPath('data.0.title', 'Changed in PostgreSQL');
    }

    public function test_deal_price_and_comparison_belong_to_the_same_winning_offer(): void
    {
        $product = Product::factory()->create();
        $promotion = Promotion::factory()->create();
        $cheap = Offer::factory()->for($product)->inStock()->create(['price_minor' => 1000, 'comparison_price_minor' => 1100]);
        $bestDiscount = Offer::factory()->for($product)->inStock()->create(['price_minor' => 1500, 'comparison_price_minor' => 3000]);
        $soldOut = Offer::factory()->for($product)->create(['price_minor' => 100, 'comparison_price_minor' => 10000]);
        $promotion->offers()->attach([$cheap->id, $bestDiscount->id, $soldOut->id]);
        $this->getJson('/api/v1/home/deals')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.price_minor', 1500)->assertJsonPath('data.0.comparison_price_minor', 3000)->assertJsonPath('data.0.discount_percent', 50);
        $this->getJson('/api/v1/products')->assertOk()->assertJsonPath('data.0.price_minor', 1000);
    }

    public function test_expired_campaigns_and_unavailable_sellers_do_not_create_deals(): void
    {
        $expired = Promotion::factory()->create(['starts_at' => now()->subDays(3), 'ends_at' => now()->subDay()]);
        $offer = Offer::factory()->inStock()->create();
        $expired->offers()->attach($offer);
        $active = Promotion::factory()->create();
        $noDiscount = Offer::factory()->inStock()->create(['comparison_price_minor' => null]);
        $soldOut = Offer::factory()->create();
        $suspended = Offer::factory()->inStock()->create();
        $suspended->seller->update(['status' => 'suspended']);
        $active->offers()->attach([$noDiscount->id, $soldOut->id, $suspended->id]);
        $this->getJson('/api/v1/home/deals')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/home/promotions')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.available_offer_count', 1);
    }

    public function test_promotion_filter_and_pagination_use_current_campaigns(): void
    {
        $promotion = Promotion::factory()->create();
        $offer = Offer::factory()->inStock()->create();
        $promotion->offers()->attach($offer);
        Offer::factory()->inStock()->create();
        $this->getJson('/api/v1/products?promotion='.$promotion->slug)->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $offer->product_id);
        $this->getJson('/api/v1/home/promotions?per_page=1')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $promotion->id);
        $promotion->update(['is_active' => false]);
        $this->getJson('/api/v1/products?promotion='.$promotion->slug)->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_best_sellers_count_only_recent_fulfilled_quantities(): void
    {
        $first = Offer::factory()->inStock()->create();
        $second = Offer::factory()->inStock()->create();
        $this->sale($first, 3, 'fulfilled', now()->subDay());
        $this->sale($second, 1, 'fulfilled', now()->subDays(2));
        $this->sale($second, 9, 'payment_failed', null);
        $this->sale($second, 9, 'fulfilled', now()->subDays(31));
        $this->getJson('/api/v1/home/best-sellers')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $first->product_id)->assertJsonPath('data.1.id', $second->product_id);
        $first->update(['is_active' => false]);
        $this->getJson('/api/v1/home/best-sellers')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $second->product_id);
    }

    public function test_home_sections_return_valid_empty_results_independently(): void
    {
        Offer::factory()->inStock()->create();
        $this->getJson('/api/v1/home/banners')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/home/best-sellers')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/home/deals')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/home/promotions')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/products')->assertOk()->assertJsonPath('meta.total', 1);
    }

    private function sale(Offer $offer, int $quantity, string $status, ?Carbon $fulfilled): void
    {
        $order = Order::factory()->create(['status' => $status, 'fulfilled_at' => $fulfilled, 'total_minor' => $offer->price_minor * $quantity]);
        $item = OrderItem::factory()->for($order)->for($offer)->create(['quantity' => $quantity, 'unit_price_minor' => $offer->price_minor]);
        PaymentAttempt::factory()->for($order)->create(['scenario' => $status === 'fulfilled' ? 'approve' : 'decline', 'status' => $status === 'fulfilled' ? 'approved' : 'declined', 'amount_minor' => $order->total_minor]);
        if ($status === 'fulfilled') {
            DigitalKey::factory()->count($quantity)->for($offer)->create(['order_item_id' => $item->id, 'allocated_at' => $fulfilled]);
        }
    }
}
