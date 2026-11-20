<?php

namespace App\Services\Cart;

use App\Models\Cart;
use App\Models\Offer;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

class CartService
{
    public const MAX_QUANTITY = 9;

    public const MAX_LINES = 20;

    public function read(Request $request): ?Cart
    {
        $cart = $this->current($request);

        return $cart ? $this->hydrate($cart) : null;
    }

    public function add(Request $request, string $offerId, int $quantity): Cart
    {
        $cart = DB::transaction(function () use ($request, $offerId, $quantity): Cart {
            $cart = $this->locked($request, true);
            $offer = Offer::query()->visible()->with(['seller', 'product'])->whereKey($offerId)->lockForUpdate()->firstOrFail();
            $item = $cart->items()->where('offer_id', $offer->id)->first();
            if (! $item && $cart->items()->count() >= self::MAX_LINES) {
                throw new HttpException(409, 'Your cart can contain up to 20 different seller offers.');
            }
            $totalQuantity = ($item?->quantity ?? 0) + $quantity;
            $this->validateAvailability($offer, $totalQuantity);
            if ($item) {
                $item->update(['quantity' => $totalQuantity]);
            } else {
                $cart->items()->create(['offer_id' => $offer->id, 'quantity' => $quantity]);
            }
            $cart->increment('version');

            return $cart;
        });
        $this->remember($request, $cart);

        return $this->hydrate($cart);
    }

    public function update(Request $request, string $itemId, int $quantity): Cart
    {
        $cart = DB::transaction(function () use ($request, $itemId, $quantity): Cart {
            $cart = $this->locked($request);
            $item = $cart->items()->whereKey($itemId)->firstOrFail();
            $offer = Offer::query()->with(['seller', 'product'])->whereKey($item->offer_id)->lockForUpdate()->firstOrFail();
            $this->validateAvailability($offer, $quantity);
            if ($item->quantity !== $quantity) {
                $item->update(['quantity' => $quantity]);
                $cart->increment('version');
            }

            return $cart;
        });

        return $this->hydrate($cart);
    }

    public function remove(Request $request, string $itemId): Cart
    {
        $cart = DB::transaction(function () use ($request, $itemId): Cart {
            $cart = $this->locked($request);
            $cart->items()->whereKey($itemId)->firstOrFail()->delete();
            $cart->increment('version');

            return $cart;
        });

        return $this->hydrate($cart);
    }

    private function current(Request $request): ?Cart
    {
        if ($request->user()) {
            return Cart::query()->where('user_id', $request->user()->id)->first();
        }
        $id = $request->session()->get('guest_cart_id');

        return is_string($id) && Str::isUuid($id) ? Cart::query()->whereKey($id)->whereNull('user_id')->first() : null;
    }

    private function locked(Request $request, bool $create = false): Cart
    {
        $cart = $this->current($request);
        if (! $cart && $create) {
            $cart = $request->user()
                ? Cart::query()->firstOrCreate(['user_id' => $request->user()->id])
                : Cart::query()->create();
        }
        abort_unless($cart, 404);

        return Cart::query()->whereKey($cart->id)->lockForUpdate()->firstOrFail();
    }

    private function remember(Request $request, Cart $cart): void
    {
        if (! $request->user()) {
            $request->session()->put('guest_cart_id', $cart->id);
        }
    }

    private function validateAvailability(Offer $offer, int $quantity): void
    {
        if ($quantity > self::MAX_QUANTITY) {
            throw new HttpException(409, 'You can add up to 9 keys from one seller offer.');
        }
        if (! $offer->is_active || ! $offer->product->is_active || $offer->seller->status !== 'active') {
            throw new HttpException(409, 'This seller offer is no longer available. You can remove it from your cart.');
        }
        $stock = $offer->availableKeys()->count();
        if ($quantity > $stock) {
            throw new HttpException(409, 'This seller has only '.$stock.' demo keys available. Refresh the offers or reduce the quantity.');
        }
    }

    private function hydrate(Cart $cart): Cart
    {
        return $cart->load([
            'items' => fn (HasMany $items): HasMany => $items->orderBy('created_at')->orderBy('id'),
            'items.offer' => fn (BelongsTo $offer): BelongsTo => $offer->with(['seller', 'product.platform', 'product.region'])->withCount('availableKeys'),
        ]);
    }
}
