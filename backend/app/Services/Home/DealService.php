<?php

namespace App\Services\Home;

use App\Models\Offer;
use App\Queries\Catalog\ProductQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class DealService
{
    public function __construct(private ProductQuery $products) {}

    public function get(): Collection
    {
        $discount = '(offers.comparison_price_minor - offers.price_minor)::numeric / offers.comparison_price_minor';
        $eligible = static fn (Builder $offer): Builder => $offer->available()->whereColumn('comparison_price_minor', '>', 'price_minor')
            ->whereHas('promotions', fn (Builder $promotion): Builder => $promotion->active());
        $ranked = $eligible(Offer::query())->select('offers.product_id', 'offers.price_minor', 'offers.id')
            ->selectRaw($discount.' AS discount_ratio')
            ->selectRaw('ROW_NUMBER() OVER (PARTITION BY offers.product_id ORDER BY '.$discount.' DESC, offers.price_minor, offers.id) AS deal_rank');
        $winningOffers = static fn (Builder $offer): Builder => $eligible($offer)->orderByRaw($discount.' DESC');

        return $this->products->cards($winningOffers)
            ->joinSub($ranked, 'ranked_deals', 'ranked_deals.product_id', '=', 'products.id')
            ->where('ranked_deals.deal_rank', 1)->orderByDesc('ranked_deals.discount_ratio')
            ->orderBy('ranked_deals.price_minor')->orderBy('products.id')->limit(12)->get();
    }
}
