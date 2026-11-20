<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Offer extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = ['product_id', 'seller_id', 'price_minor', 'comparison_price_minor', 'currency', 'is_active'];

    protected function casts(): array
    {
        return ['price_minor' => 'integer', 'comparison_price_minor' => 'integer', 'is_active' => 'boolean'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function digitalKeys(): HasMany
    {
        return $this->hasMany(DigitalKey::class);
    }

    public function availableKeys(): HasMany
    {
        return $this->digitalKeys()->available();
    }

    public function cartItems(): HasMany
    {
        return $this->hasMany(CartItem::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function promotions(): BelongsToMany
    {
        return $this->belongsToMany(Promotion::class);
    }

    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('offers.is_active', true)->whereHas('seller', fn (Builder $seller): Builder => $seller->active())->whereHas('product', fn (Builder $product): Builder => $product->published());
    }

    public function scopeAvailable(Builder $query): Builder
    {
        return $query->visible()->whereHas('availableKeys');
    }

    protected static function booted(): void
    {
        static::updating(function (Offer $offer): void {
            if ($offer->isDirty(['product_id', 'seller_id'])) {
                throw new \LogicException('An offer cannot be moved to another product or seller.');
            }
        });
    }
}
