<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $available = $this->offers->filter(fn ($offer): bool => $offer->available_keys_count > 0);
        $offer = $available->first();
        $comparison = $offer?->comparison_price_minor;
        $discount = $comparison && $comparison > $offer->price_minor ? (int) floor(100 * ($comparison - $offer->price_minor) / $comparison) : null;

        return [
            'id' => $this->id, 'slug' => $this->slug, 'title' => $this->title, 'type' => $this->type,
            'cover_image_url' => asset(ltrim($this->cover_image_path, '/')),
            'platform' => ['id' => $this->platform->id, 'slug' => $this->platform->slug, 'name' => $this->platform->name],
            'region' => ['id' => $this->region->id, 'code' => $this->region->code, 'name' => $this->region->name],
            'categories' => CategoryResource::collection($this->categories),
            'price_minor' => $offer?->price_minor, 'comparison_price_minor' => $comparison,
            'discount_percent' => $discount, 'currency' => 'EUR',
            'available_offer_count' => $available->count(), 'is_available' => $offer !== null,
            'description' => $this->when($request->routeIs('api.v1.products.show'), $this->description),
            'requirements' => $this->when($request->routeIs('api.v1.products.show'), $this->requirements),
            'delivery_information' => $this->when($request->routeIs('api.v1.products.show'), $this->delivery_information),
            'compatibility_notice' => $this->when($request->routeIs('api.v1.products.show'), $this->compatibility_notice),
            'edition' => $this->when($request->routeIs('api.v1.products.show'), $this->edition),
            'publisher' => $this->when($request->routeIs('api.v1.products.show'), $this->publisher),
            'release_date' => $this->when($request->routeIs('api.v1.products.show'), $this->release_date?->toDateString()),
            'activation_instructions' => $this->when($request->routeIs('api.v1.products.show'), fn (): string => implode("\n", $this->requirements['activation_steps'] ?? [$this->platform->activation_instructions])),
            'activation_notice' => $this->when($request->routeIs('api.v1.products.show'), $this->region->activation_notice),
            'offers' => $this->when($request->routeIs('api.v1.products.show'), fn () => OfferResource::collection($this->offers)),
        ];
    }
}
