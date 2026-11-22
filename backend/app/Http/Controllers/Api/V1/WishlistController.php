<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\WishlistIndexRequest;
use App\Http\Requests\WishlistStoreRequest;
use App\Http\Resources\ProductResource;
use App\Services\Wishlist\WishlistService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class WishlistController extends Controller
{
    public function index(WishlistIndexRequest $request, WishlistService $wishlist): AnonymousResourceCollection
    {
        return ProductResource::collection($wishlist->listing($request->user(), $request->integer('per_page', 24)));
    }

    public function summary(Request $request, WishlistService $wishlist): JsonResponse
    {
        return response()->json(['data' => $wishlist->summary($request->user())]);
    }

    public function store(WishlistStoreRequest $request, WishlistService $wishlist): JsonResponse
    {
        return response()->json(['data' => $wishlist->save($request->user(), $request->validated('product_id'))]);
    }

    public function destroy(Request $request, string $product, WishlistService $wishlist): JsonResponse
    {
        return response()->json(['data' => $wishlist->remove($request->user(), $product)]);
    }
}
