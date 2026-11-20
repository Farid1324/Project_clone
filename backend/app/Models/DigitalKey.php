<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DigitalKey extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = ['offer_id', 'key_ciphertext', 'order_item_id', 'allocated_at', 'retired_at'];

    protected $hidden = ['key_ciphertext', 'fingerprint'];

    protected function casts(): array
    {
        return ['key_ciphertext' => 'encrypted', 'allocated_at' => 'datetime', 'retired_at' => 'datetime'];
    }

    public function offer(): BelongsTo
    {
        return $this->belongsTo(Offer::class);
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function scopeAvailable(Builder $query): Builder
    {
        return $query->whereNull('order_item_id')->whereNull('retired_at');
    }

    protected static function booted(): void
    {
        static::saving(function (DigitalKey $key): void {
            if ($key->isDirty('key_ciphertext')) {
                $secret = config('marketplace.key_fingerprint_secret');
                if (! is_string($secret) || strlen($secret) < 32) {
                    throw new \LogicException('Configure a stable KEY_FINGERPRINT_SECRET with at least 32 characters.');
                }
                $key->fingerprint = hash_hmac('sha256', strtoupper(trim($key->key_ciphertext)), $secret);
            }
            if ($key->exists && $key->getOriginal('order_item_id') !== null && $key->isDirty(['order_item_id', 'offer_id', 'key_ciphertext'])) {
                throw new \LogicException('Allocated digital keys cannot be reassigned or replaced.');
            }
        });
    }
}
