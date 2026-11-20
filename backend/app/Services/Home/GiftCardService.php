<?php

namespace App\Services\Home;

use App\Models\Product;
use App\Queries\Catalog\ProductQuery;
use App\Queries\Catalog\RecentSalesQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class GiftCardService
{
    public function __construct(private ProductQuery $products, private RecentSalesQuery $sales) {}

    /** @return Collection<int, Product> */
    public function get(): Collection
    {
        return $this->products->cards()->where('products.type', 'gift_card')
            ->whereHas('offers', fn (Builder $offer): Builder => $offer->available())
            ->leftJoinSub($this->sales->byProduct(), 'sales', 'sales.product_id', '=', 'products.id')
            ->orderByRaw('COALESCE(sales.units_sold, 0) DESC')
            ->orderBy('lowest_price')->orderBy('products.id')->limit(12)->get();
    }
}
