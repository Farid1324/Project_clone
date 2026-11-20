<?php

namespace App\Http\Resources;

use App\Models\CartItem;
use App\Services\Cart\CartService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CartResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        if ($this->resource === null) {
            return ['id' => null, 'version' => 0, 'currency' => 'EUR', 'items' => [], 'items_count' => 0, 'total_minor' => 0, 'has_unavailable_items' => false, 'limits' => $this->limits()];
        }
        $items = $this->items->map(fn (CartItem $item): array => $this->line($item));

        return [
            'id' => $this->id, 'version' => $this->version, 'currency' => 'EUR',
            'items' => $items, 'items_count' => $items->sum('quantity'),
            'total_minor' => $items->sum('line_total_minor'),
            'has_unavailable_items' => $items->contains(fn (array $item): bool => ! $item['is_available']),
            'limits' => $this->limits(),
        ];
    }

    private function limits(): array
    {
        return ['quantity_per_offer' => CartService::MAX_QUANTITY, 'distinct_offers' => CartService::MAX_LINES];
    }

    private function line(CartItem $item): array
    {
        $offer = $item->offer;
        $product = $offer->product;
        $visible = $offer->is_active && $product->is_active && $offer->seller->status === 'active';
        $stock = (int) $offer->available_keys_count;

        return [
            'id' => $item->id, 'offer_id' => $offer->id, 'quantity' => $item->quantity,
            'product' => ['id' => $product->id, 'slug' => $product->slug, 'title' => $product->title, 'cover_image_url' => asset(ltrim($product->cover_image_path, '/')),
                'platform' => ['id' => $product->platform->id, 'name' => $product->platform->name, 'slug' => $product->platform->slug],
                'region' => ['id' => $product->region->id, 'code' => $product->region->code, 'name' => $product->region->name]],
            'seller' => ['id' => $offer->seller->id, 'name' => $offer->seller->name, 'rating' => $offer->seller->rating, 'rating_count' => $offer->seller->rating_count],
            'unit_price_minor' => $offer->price_minor, 'line_total_minor' => $offer->price_minor * $item->quantity,
            'stock_available' => $visible ? $stock : 0,
            'is_available' => $visible && $stock >= $item->quantity,
        ];
    }
}
