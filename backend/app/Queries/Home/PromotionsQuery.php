<?php

namespace App\Queries\Home;

use App\Models\Promotion;
use Illuminate\Database\Eloquent\Builder;

class PromotionsQuery
{
    public function query(): Builder
    {
        return Promotion::query()->active()->whereHas('offers', fn (Builder $offers): Builder => $offers->available())
            ->withCount(['offers' => fn (Builder $offers): Builder => $offers->available()])
            ->orderBy('title')->orderBy('id');
    }
}
