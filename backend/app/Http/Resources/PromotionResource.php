<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PromotionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'slug' => $this->slug, 'title' => $this->title, 'description' => $this->description,
            'image_url' => asset(ltrim($this->image_path, '/')), 'starts_at' => $this->starts_at?->toIso8601String(), 'ends_at' => $this->ends_at?->toIso8601String(),
            'available_offer_count' => (int) $this->offers_count];
    }
}
