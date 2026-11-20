<?php

namespace App\Services\Home;

use App\Models\HomepageBanner;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class BannerService
{
    public function get(): Collection
    {
        return HomepageBanner::query()->active()->with('product')
            ->where(fn (Builder $query): Builder => $query->where('destination_type', 'store')->orWhereHas('product', fn (Builder $product): Builder => $product->published()))
            ->orderBy('sort_order')->orderBy('id')->limit(8)->get();
    }
}
