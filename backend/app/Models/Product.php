<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = ['platform_id', 'region_id', 'slug', 'title', 'type', 'edition', 'description', 'cover_image_path', 'publisher', 'release_date', 'is_active', 'requirements', 'delivery_information', 'compatibility_notice'];

    protected function casts(): array
    {
        return ['release_date' => 'date', 'is_active' => 'boolean', 'requirements' => 'array'];
    }

    public function platform(): BelongsTo
    {
        return $this->belongsTo(Platform::class);
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class);
    }

    public function offers(): HasMany
    {
        return $this->hasMany(Offer::class);
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('products.is_active', true);
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
