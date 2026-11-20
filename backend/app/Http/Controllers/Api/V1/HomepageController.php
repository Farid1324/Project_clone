<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\PaginationRequest;
use App\Http\Resources\BannerResource;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\PromotionResource;
use App\Queries\Home\PromotionsQuery;
use App\Services\Home\BannerService;
use App\Services\Home\BestSellerService;
use App\Services\Home\DealService;
use App\Services\Home\GiftCardService;
use App\Services\Home\PopularCategoryService;
use App\Services\Home\RecommendationService;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class HomepageController extends Controller
{
    public function banners(BannerService $banners): AnonymousResourceCollection
    {
        return BannerResource::collection($banners->get());
    }

    public function categories(PopularCategoryService $categories): AnonymousResourceCollection
    {
        return CategoryResource::collection($categories->get());
    }

    public function bestSellers(BestSellerService $sellers): AnonymousResourceCollection
    {
        return ProductResource::collection($sellers->get());
    }

    public function deals(DealService $deals): AnonymousResourceCollection
    {
        return ProductResource::collection($deals->get());
    }

    public function giftCards(GiftCardService $giftCards): AnonymousResourceCollection
    {
        return ProductResource::collection($giftCards->get());
    }

    public function recommendations(RecommendationService $recommendations): AnonymousResourceCollection
    {
        return ProductResource::collection($recommendations->get());
    }

    public function promotions(PaginationRequest $request, PromotionsQuery $promotions): AnonymousResourceCollection
    {
        return PromotionResource::collection($promotions->query()->paginate($request->integer('per_page', 12))->withQueryString());
    }
}
