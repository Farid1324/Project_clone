<?php

namespace App\Services\Home;

use App\Models\Offer;
use App\Models\Product;
use App\Queries\Catalog\ProductQuery;
use Illuminate\Database\Eloquent\Collection;

class RecommendationService
{
    public function __construct(private ProductQuery $products) {}

    /** Public discovery ranking; no account data or inferred personal preferences.
     * @return Collection<int, Product>
     */
    public function get(): Collection
    {
        $ratedOffers = Offer::query()->available()
            ->join('sellers', 'sellers.id', '=', 'offers.seller_id')
            ->select('offers.product_id')
            ->selectRaw('MAX(sellers.rating) AS seller_rating, COUNT(*) AS available_sellers')
            ->groupBy('offers.product_id');

        return $this->products->cards()
            ->joinSub($ratedOffers, 'recommendations', 'recommendations.product_id', '=', 'products.id')
            ->orderByDesc('recommendations.seller_rating')->orderByDesc('recommendations.available_sellers')
            ->orderByRaw('products.release_date DESC NULLS LAST')->orderByDesc('products.created_at')
            ->orderBy('products.id')->limit(12)->get();
    }
}
