<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\DigitalKey;
use App\Models\Offer;
use App\Models\PaymentAttempt;
use App\Models\Region;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CheckoutTest extends TestCase
{
    use RefreshDatabase;

    private function ready(int $quantity = 1, int $stock = 3): array
    {
        $user = User::factory()->create();
        $offer = Offer::factory()->inStock($stock)->create(['price_minor' => 1299]);
        $cart = Cart::factory()->for($user)->create();
        CartItem::factory()->for($cart)->for($offer)->create(['quantity' => $quantity]);
        $this->actingAs($user, 'web');
        $quote = $this->getJson('/api/v1/checkout/quote')->assertOk()->json('data');

        return [$user, $offer, $cart, ['quote_token' => $quote['quote_token'], 'scenario' => 'approve', 'idempotency_key' => (string) Str::uuid()]];
    }

    public function test_success_creates_exact_snapshots_allocates_unique_encrypted_keys_and_clears_cart(): void
    {
        [$user, $offer, $cart, $payload] = $this->ready(2);
        $r = $this->postJson('/api/v1/checkout', $payload)->assertCreated()->assertJsonPath('data.status', 'fulfilled')->assertJsonPath('data.total_minor', 2598)->assertJsonPath('data.payment.status', 'approved')->assertJsonMissingPath('data.items.0.keys');
        $id = $r->json('data.id');
        $this->assertSame(0, $cart->items()->count());
        $this->assertSame(1, $offer->availableKeys()->count());
        $this->assertSame(2, DigitalKey::whereNotNull('order_item_id')->count());
        $this->assertSame(2598, PaymentAttempt::sole()->amount_minor);
        $detail = $this->getJson('/api/v1/orders/'.$id)->assertOk()->assertJsonCount(2, 'data.items.0.keys')->assertHeader('Cache-Control', 'no-store, private');
        foreach ($detail->json('data.items.0.keys') as $key) {
            $this->assertStringStartsWith('DEMO-NOT-REDEEMABLE-', $key);
            $this->assertStringNotContainsString($key, DigitalKey::whereNotNull('order_item_id')->first()->getRawOriginal('key_ciphertext'));
        }
        $this->getJson('/api/v1/orders')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonMissingPath('data.0.items.0.keys');
        $offer->update(['price_minor' => 1999]);
        $this->getJson('/api/v1/orders/'.$id)->assertJsonPath('data.items.0.unit_price_minor', 1299);
    }

    public function test_decline_records_failed_order_without_allocation_or_cart_changes_and_retry_is_idempotent(): void
    {
        [, $offer, $cart, $payload] = $this->ready(2);
        $payload['scenario'] = 'decline';
        $id = $this->postJson('/api/v1/checkout', $payload)->assertCreated()->assertJsonPath('data.status', 'payment_failed')->assertJsonPath('data.payment.status', 'declined')->json('data.id');
        $this->assertSame(3, $offer->availableKeys()->count());
        $this->assertSame(1, $cart->items()->count());
        $this->assertSame(1, $cart->fresh()->version);
        $this->getJson('/api/v1/orders/'.$id)->assertJsonMissingPath('data.items.0.keys');
        $this->postJson('/api/v1/checkout', $payload)->assertJsonPath('data.id', $id);
        $this->assertDatabaseCount('orders', 1);
        $payload['scenario'] = 'approve';
        $payload['idempotency_key'] = (string) Str::uuid();
        $this->postJson('/api/v1/checkout', $payload)->assertJsonPath('data.status', 'fulfilled');
        $this->assertDatabaseCount('orders', 2);
    }

    public function test_success_replay_survives_cleared_cart_and_expired_quote_but_changed_payload_conflicts(): void
    {
        [, , , $payload] = $this->ready();
        $id = $this->postJson('/api/v1/checkout', $payload)->assertCreated()->json('data.id');
        $this->travel(11)->minutes();
        $this->postJson('/api/v1/checkout', $payload)->assertOk()->assertJsonPath('data.id', $id);
        $this->postJson('/api/v1/checkout', [...$payload, 'scenario' => 'decline'])->assertConflict();
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('payment_attempts', 1);
        $this->assertSame(1, DigitalKey::whereNotNull('order_item_id')->count());
    }

    public function test_insufficient_stock_rolls_back_without_order_payment_or_allocation(): void
    {
        [, $offer, $cart, $payload] = $this->ready(2);
        $offer->availableKeys()->limit(2)->get()->each->update(['retired_at' => now()]);
        $this->postJson('/api/v1/checkout', $payload)->assertConflict();
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('payment_attempts', 0);
        $this->assertSame(0, DigitalKey::whereNotNull('order_item_id')->count());
        $this->assertSame(1, $cart->items()->count());
    }

    public function test_price_stock_cart_and_expiry_changes_require_new_confirmation(): void
    {
        [, $offer, $cart, $payload] = $this->ready();
        $offer->update(['price_minor' => 1499]);
        $this->postJson('/api/v1/checkout', $payload)->assertConflict();
        $payload['quote_token'] = $this->getJson('/api/v1/checkout/quote')->json('data.quote_token');
        DigitalKey::factory()->for($offer)->create();
        $this->postJson('/api/v1/checkout', $payload)->assertConflict();
        $payload['quote_token'] = $this->getJson('/api/v1/checkout/quote')->json('data.quote_token');
        $cart->increment('version');
        $this->postJson('/api/v1/checkout', $payload)->assertConflict();
        $payload['quote_token'] = $this->getJson('/api/v1/checkout/quote')->json('data.quote_token');
        $this->travel(11)->minutes();
        $this->postJson('/api/v1/checkout', $payload)->assertConflict();
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_quote_ownership_tampering_and_client_payment_fields_are_rejected(): void
    {
        [, , , $payload] = $this->ready();
        $this->postJson('/api/v1/checkout', [...$payload, 'price_minor' => 1, 'card_number' => 'never accepted'])->assertUnprocessable();
        $this->postJson('/api/v1/checkout', [...$payload, 'quote_token' => 'forged'])->assertConflict();
        $this->postJson('/api/v1/checkout', [...$payload, 'scenario' => 'real'])->assertUnprocessable();
        $this->app['auth']->forgetGuards();
        $this->actingAs(User::factory()->create(), 'web')->postJson('/api/v1/checkout', $payload)->assertConflict();
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_other_users_cannot_read_order_or_keys_and_order_lists_are_owner_scoped_paginated(): void
    {
        [$owner, , , $payload] = $this->ready();
        $id = $this->postJson('/api/v1/checkout', $payload)->assertCreated()->json('data.id');
        $this->app['auth']->forgetGuards();
        $this->actingAs(User::factory()->create(), 'web')->getJson('/api/v1/orders/'.$id)->assertNotFound();
        $this->getJson('/api/v1/orders')->assertJsonPath('meta.total', 0);
        $this->app['auth']->forgetGuards();
        $this->actingAs($owner, 'web')->getJson('/api/v1/orders?per_page=1&page=2')->assertJsonPath('meta.total', 1)->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/orders?per_page=25')->assertUnprocessable();
    }

    public function test_internal_failure_after_allocation_rolls_back_every_record(): void
    {
        [, $offer, $cart, $payload] = $this->ready(2);
        DigitalKey::updated(function (): void {
            throw new \RuntimeException('Injected allocation failure');
        });
        try {
            $this->postJson('/api/v1/checkout', $payload)->assertStatus(500)->assertJsonPath('error.code', 'internal_error');
        } finally {
            DigitalKey::flushEventListeners();
        }
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('order_items', 0);
        $this->assertDatabaseCount('payment_attempts', 0);
        $this->assertSame(3, $offer->availableKeys()->count());
        $this->assertSame(1, $cart->items()->count());
    }

    public function test_empty_and_disabled_seller_checkout_are_rejected(): void
    {
        [, $offer, , $payload] = $this->ready();
        $offer->seller->update(['status' => 'suspended']);
        $this->postJson('/api/v1/checkout', $payload)->assertConflict();
        CartItem::query()->delete();
        $this->getJson('/api/v1/checkout/quote')->assertConflict();
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_platform_or_region_changes_invalidate_an_existing_quote(): void
    {
        [, $offer, , $payload] = $this->ready();
        $offer->product->update(['region_id' => Region::factory()->create()->id]);
        $this->postJson('/api/v1/checkout', $payload)->assertConflict();
        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(3, $offer->availableKeys()->count());
    }

    public function test_one_insufficient_offer_rejects_the_entire_multi_offer_purchase(): void
    {
        [, $first, $cart, $payload] = $this->ready();
        $second = Offer::factory()->inStock(1)->create();
        CartItem::factory()->for($cart)->for($second)->create(['quantity' => 1]);
        $payload['quote_token'] = $this->getJson('/api/v1/checkout/quote')->json('data.quote_token');
        $second->availableKeys()->sole()->update(['retired_at' => now()]);
        $this->postJson('/api/v1/checkout', $payload)->assertConflict();
        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(3, $first->availableKeys()->count());
        $this->assertSame(2, $cart->items()->count());
    }
}
