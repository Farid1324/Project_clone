<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\PaginationRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Models\Platform;
use App\Models\Region;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CategoryController extends Controller
{
    public function index(PaginationRequest $request): AnonymousResourceCollection
    {
        return CategoryResource::collection(Category::query()->withCount(['products' => fn (Builder $products): Builder => $products->published()])
            ->orderBy('name')->orderBy('id')->paginate($request->integer('per_page', 24))->withQueryString());
    }

    public function show(string $slug): CategoryResource
    {
        return new CategoryResource(Category::query()->where('slug', $slug)
            ->withCount(['products' => fn (Builder $products): Builder => $products->published()])->firstOrFail());
    }

    public function filters(): JsonResponse
    {
        return response()->json(['data' => [
            'categories' => Category::query()->orderBy('name')->get(['id', 'name', 'slug']),
            'platforms' => Platform::query()->orderBy('name')->get(['id', 'name', 'slug']),
            'regions' => Region::query()->orderBy('name')->get(['id', 'name', 'code', 'activation_notice']),
        ]]);
    }
}
