<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

trait HasActiveWindow
{
    public function scopeActive(Builder $query): Builder
    {
        $now = now();

        return $query->where('is_active', true)
            ->where(fn (Builder $window): Builder => $window->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
            ->where(fn (Builder $window): Builder => $window->whereNull('ends_at')->orWhere('ends_at', '>', $now));
    }
}
