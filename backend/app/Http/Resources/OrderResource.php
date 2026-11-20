<?php

namespace App\Http\Resources;

use App\Models\DigitalKey;
use App\Models\OrderItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'status' => $this->status, 'currency' => $this->currency, 'total_minor' => $this->total_minor,
            'created_at' => $this->created_at->toIso8601String(), 'fulfilled_at' => $this->fulfilled_at?->toIso8601String(),
            'payment' => ['provider' => $this->paymentAttempt->provider, 'status' => $this->paymentAttempt->status, 'reference' => $this->paymentAttempt->reference],
            'items' => $this->items->map(fn (OrderItem $item): array => [
                'id' => $item->id, 'offer_id' => $item->offer_id, 'product_title' => $item->product_title_snapshot, 'seller_name' => $item->seller_name_snapshot,
                'platform_name' => $item->platform_name_snapshot, 'region_name' => $item->region_name_snapshot,
                'unit_price_minor' => $item->unit_price_minor, 'quantity' => $item->quantity, 'line_total_minor' => $item->line_total_minor,
                ...($this->status === 'fulfilled' && $item->relationLoaded('digitalKeys') ? ['keys' => $item->digitalKeys->map(fn (DigitalKey $key): string => $key->key_ciphertext)->all()] : []),
            ])];
    }
}
