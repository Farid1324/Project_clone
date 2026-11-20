<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductIndexRequest;
use App\Http\Requests\SuggestionRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Queries\Catalog\ProductQuery;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductController extends Controller
{
    public function index(ProductIndexRequest $request, ProductQuery $products): AnonymousResourceCollection
    {
        return ProductResource::collection($products->paginate($request->validated(), $request->integer('per_page', 24))->withQueryString());
    }

    public function show(string $slug): ProductResource
    {
        $product = Product::query()->published()->where('slug', $slug)->with([
            'categories', 'platform', 'region', 'offers' => fn (HasMany $offers): HasMany => $offers->visible()
                ->with(['seller', 'promotions' => fn (BelongsToMany $promotion): BelongsToMany => $promotion->active()])
                ->withCount('availableKeys')->orderBy('price_minor')->orderBy('id'),
        ])->firstOrFail();

        return new ProductResource($product);
    }

    public function suggestions(SuggestionRequest $request, ProductQuery $products): AnonymousResourceCollection
    {
        return ProductResource::collection($products->suggestions($request->validated('q'), $request->integer('limit', 8)));
    }
}
