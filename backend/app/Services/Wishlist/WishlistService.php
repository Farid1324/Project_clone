<?php

namespace App\Services\Wishlist;

use App\Models\Product;
use App\Models\User;
use App\Queries\Catalog\ProductQuery;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class WishlistService
{
    public function __construct(private ProductQuery $products) {}

    public function listing(User $user, int $perPage): LengthAwarePaginator
    {
        return $this->products->cards(publishedOnly: false)
            ->join('wishlist_items', fn (JoinClause $join): JoinClause => $join->on('wishlist_items.product_id', '=', 'products.id')->where('wishlist_items.user_id', $user->id))
            ->orderByDesc('wishlist_items.created_at')->orderByDesc('wishlist_items.id')->paginate($perPage)->withQueryString();
    }

    /** @return array{count: int, product_ids: list<string>} */
    public function summary(User $user): array
    {
        $ids = $user->wishlistItems()->orderBy('product_id')->pluck('product_id')->all();

        return ['count' => count($ids), 'product_ids' => $ids];
    }

    /** @return array{count: int, product_ids: list<string>} */
    public function save(User $user, string $productId): array
    {
        return DB::transaction(function () use ($user, $productId): array {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            if (! $user->wishlistItems()->where('product_id', $productId)->exists()) {
                Product::query()->published()->whereKey($productId)->firstOrFail();
                $user->wishlistItems()->firstOrCreate(['product_id' => $productId]);
            }

            return $this->summary($user);
        }, 3);
    }

    /** @return array{count: int, product_ids: list<string>} */
    public function remove(User $user, string $productId): array
    {
        return DB::transaction(function () use ($user, $productId): array {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $user->wishlistItems()->where('product_id', $productId)->delete();

            return $this->summary($user);
        }, 3);
    }
}
