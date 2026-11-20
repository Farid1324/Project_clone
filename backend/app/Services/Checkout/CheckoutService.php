<?php

namespace App\Services\Checkout;

use App\Http\Resources\CartResource;
use App\Models\Cart;
use App\Models\Offer;
use App\Models\Order;
use App\Models\User;
use App\Services\Cart\CartService;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use JsonException;

class CheckoutService
{
    public function __construct(private CartService $carts, private SimulatedPayment $payments) {}

    public function quote(Request $request): array
    {
        $cart = $this->carts->read($request);
        abort_unless($cart && $cart->items->isNotEmpty(), 409, 'Your cart is empty.');
        $data = (new CartResource($cart))->resolve($request);
        $expires = now()->addMinutes(10);
        $payload = ['user_id' => $request->user()->id, 'cart_id' => $cart->id, 'version' => $cart->version, 'expires_at' => $expires->timestamp,
            'lines' => $this->lines($data), 'total_minor' => $data['total_minor']];

        return ['cart' => $data, 'quote_token' => Crypt::encryptString(json_encode($payload, JSON_THROW_ON_ERROR)),
            'checked_at' => now()->toIso8601String(), 'expires_at' => $expires->toIso8601String()];
    }

    public function purchase(User $user, string $token, string $idempotencyKey, string $scenario): Order
    {
        return DB::transaction(function () use ($user, $token, $idempotencyKey, $scenario): Order {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $hash = hash('sha256', $token.'|'.$scenario);
            $existing = Order::query()->where('user_id', $user->id)->where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                abort_unless(hash_equals($existing->request_hash, $hash), 409, 'This request ID was already used for a different checkout. Review your order history.');

                return $existing->load(['items', 'paymentAttempt']);
            }
            try {
                $quote = json_decode(Crypt::decryptString($token), true, 512, JSON_THROW_ON_ERROR);
            } catch (DecryptException|JsonException $exception) {
                abort(409, 'The checkout quote is invalid. Refresh the order summary.');
            }
            abort_unless(is_array($quote) && ($quote['user_id'] ?? null) === $user->id && ($quote['expires_at'] ?? 0) > now()->timestamp, 409, 'The checkout quote has expired or belongs to another account. Refresh the order summary.');
            $cart = Cart::query()->where('user_id', $user->id)->whereKey($quote['cart_id'])->lockForUpdate()->first();
            abort_unless($cart && $cart->version === $quote['version'], 409, 'Your cart changed. Review the updated order summary.');
            $items = $cart->items()->orderBy('offer_id')->get();
            abort_if($items->isEmpty(), 409, 'Your cart is empty.');
            $offers = Offer::query()->whereIn('id', $items->pluck('offer_id'))->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $offers->load(['seller', 'product.platform', 'product.region']);
            $current = [];
            $keys = [];
            foreach ($items as $item) {
                $offer = $offers->get($item->offer_id);
                abort_unless($offer && $offer->is_active && $offer->product->is_active && $offer->seller->status === 'active', 409, 'A selected seller offer is no longer available. Review your cart.');
                $stock = $offer->availableKeys()->count();
                abort_if($item->quantity > $stock, 409, 'A selected seller has insufficient stock. Review the updated order summary.');
                $current[] = ['offer_id' => $offer->id, 'quantity' => $item->quantity, 'price_minor' => $offer->price_minor, 'stock_available' => $stock,
                    'product_id' => $offer->product_id, 'platform_id' => $offer->product->platform_id, 'region_id' => $offer->product->region_id];
                if ($scenario === 'approve') {
                    $keys[$offer->id] = $offer->availableKeys()->orderBy('id')->limit($item->quantity)->lockForUpdate()->get();
                    abort_unless($keys[$offer->id]->count() === $item->quantity, 409, 'Inventory changed. Refresh the order summary.');
                }
            }
            abort_unless($current === $quote['lines'], 409, 'Price, stock or compatibility changed. Review the updated order summary before paying again.');
            $approved = $this->payments->approve($scenario);
            $total = array_sum(array_map(fn (array $line): int => $line['price_minor'] * $line['quantity'], $current));
            $order = Order::query()->create(['user_id' => $user->id, 'idempotency_key' => $idempotencyKey, 'request_hash' => $hash,
                'status' => $approved ? 'fulfilled' : 'payment_failed', 'currency' => 'EUR', 'total_minor' => $total, 'fulfilled_at' => $approved ? now() : null]);
            foreach ($items as $item) {
                $offer = $offers->get($item->offer_id);
                $purchased = $order->items()->create(['offer_id' => $offer->id, 'product_title_snapshot' => $offer->product->title,
                    'seller_name_snapshot' => $offer->seller->name, 'platform_name_snapshot' => $offer->product->platform->name,
                    'region_name_snapshot' => $offer->product->region->name, 'unit_price_minor' => $offer->price_minor, 'quantity' => $item->quantity]);
                if ($approved) {
                    foreach ($keys[$offer->id] as $key) {
                        $key->update(['order_item_id' => $purchased->id, 'allocated_at' => now()]);
                    }
                }
            }
            $order->paymentAttempt()->create(['provider' => 'simulated', 'scenario' => $scenario, 'status' => $approved ? 'approved' : 'declined', 'reference' => Str::uuid(), 'amount_minor' => $total]);
            if ($approved) {
                $cart->items()->delete();
                $cart->increment('version');
            }

            return $order->load(['items', 'paymentAttempt']);
        }, 3);
    }

    private function lines(array $cart): array
    {
        $lines = array_map(fn (array $item): array => ['offer_id' => $item['offer_id'], 'quantity' => $item['quantity'], 'price_minor' => $item['unit_price_minor'], 'stock_available' => $item['stock_available'],
            'product_id' => $item['product']['id'], 'platform_id' => $item['product']['platform']['id'], 'region_id' => $item['product']['region']['id']], collect($cart['items'])->all());
        usort($lines, fn (array $a, array $b): int => strcmp($a['offer_id'], $b['offer_id']));

        return $lines;
    }
}
