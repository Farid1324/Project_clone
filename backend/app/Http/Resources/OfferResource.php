<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OfferResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'product_id' => $this->product_id,
            'seller' => ['id' => $this->seller->id, 'name' => $this->seller->name, 'rating' => $this->seller->rating, 'rating_count' => $this->seller->rating_count],
            'price_minor' => $this->price_minor, 'comparison_price_minor' => $this->comparison_price_minor,
            'currency' => $this->currency, 'stock_available' => (int) $this->available_keys_count,
            'is_available' => $this->available_keys_count > 0,
            'promotions' => $this->whenLoaded('promotions', fn () => $this->promotions->map(fn ($promotion): array => ['id' => $promotion->id, 'slug' => $promotion->slug, 'title' => $promotion->title])),
        ];
    }
}
