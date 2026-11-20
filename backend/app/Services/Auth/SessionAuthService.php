<?php

namespace App\Services\Auth;

use App\Models\Cart;
use App\Models\User;
use App\Services\Cart\CartService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SessionAuthService
{
    public function mergeCart(Request $request, User $user): array
    {
        $notices = DB::transaction(function () use ($request, $user): array {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $id = $request->session()->get('guest_cart_id');
            $guest = is_string($id) && Str::isUuid($id) ? Cart::query()->whereKey($id)->whereNull('user_id')->lockForUpdate()->first() : null;
            if (! $guest) {
                return [];
            }
            $owned = Cart::query()->where('user_id', $user->id)->lockForUpdate()->first();
            if (! $owned) {
                $guest->update(['user_id' => $user->id]);
                $guest->increment('version');

                return [];
            }
            $notices = [];
            foreach ($guest->items()->orderBy('created_at')->orderBy('id')->get() as $item) {
                $existing = $owned->items()->where('offer_id', $item->offer_id)->first();
                if (! $existing && $owned->items()->count() >= CartService::MAX_LINES) {
                    $notices[] = 'Your saved cart was kept. Additional guest offers above the 20-offer limit were not merged.';

                    continue;
                }
                $quantity = ($existing?->quantity ?? 0) + $item->quantity;
                if ($quantity > CartService::MAX_QUANTITY) {
                    $notices[] = 'A combined seller-offer quantity was limited to 9. Please review your cart.';
                }
                $owned->items()->updateOrCreate(['offer_id' => $item->offer_id], ['quantity' => min(CartService::MAX_QUANTITY, $quantity)]);
            }
            $owned->increment('version');
            $guest->delete();

            return array_values(array_unique($notices));
        }, 3);
        $request->session()->forget('guest_cart_id');

        return $notices;
    }
}
