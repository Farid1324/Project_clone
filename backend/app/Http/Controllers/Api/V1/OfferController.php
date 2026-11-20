<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\OfferIndexRequest;
use App\Http\Resources\OfferResource;
use App\Models\Offer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OfferController extends Controller
{
    private function visibleOffers(): Builder
    {
        return Offer::query()->visible()->with(['seller', 'promotions' => fn (BelongsToMany $promotion): BelongsToMany => $promotion->active()])->withCount('availableKeys');
    }

    public function index(OfferIndexRequest $request): AnonymousResourceCollection
    {
        $query = $this->visibleOffers();
        if ($request->boolean('in_stock', true)) {
            $query->whereHas('availableKeys');
        }
        foreach (['product_id', 'seller_id'] as $field) {
            if ($request->filled($field)) {
                $query->where($field, $request->validated($field));
            }
        }

        return OfferResource::collection($query->orderBy('price_minor')->orderBy('id')->paginate($request->integer('per_page', 24))->withQueryString());
    }

    public function show(string $offer): OfferResource
    {
        return new OfferResource($this->visibleOffers()->findOrFail($offer));
    }
}
