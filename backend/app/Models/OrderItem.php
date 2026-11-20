<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderItem extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = ['order_id', 'offer_id', 'product_title_snapshot', 'seller_name_snapshot', 'platform_name_snapshot', 'region_name_snapshot', 'unit_price_minor', 'quantity'];

    protected function casts(): array
    {
        return ['unit_price_minor' => 'integer', 'quantity' => 'integer', 'line_total_minor' => 'integer'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function offer(): BelongsTo
    {
        return $this->belongsTo(Offer::class);
    }

    public function digitalKeys(): HasMany
    {
        return $this->hasMany(DigitalKey::class);
    }

    protected static function booted(): void
    {
        static::updating(function (OrderItem $item): void {
            if ($item->isDirty(['order_id', 'offer_id', 'unit_price_minor', 'quantity', 'product_title_snapshot', 'seller_name_snapshot', 'platform_name_snapshot', 'region_name_snapshot'])) {
                throw new \LogicException('Purchased order snapshots are immutable.');
            }
        });
    }
}
