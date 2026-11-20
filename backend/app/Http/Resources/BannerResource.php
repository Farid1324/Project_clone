<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BannerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'title' => $this->title, 'subtitle' => $this->subtitle,
            'image_url' => asset(ltrim($this->image_path, '/')), 'image_alt' => $this->image_alt,
            'destination' => ['type' => $this->destination_type, 'product_slug' => $this->product?->slug]];
    }
}
