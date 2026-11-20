<?php

namespace App\Services\Home;

use App\Models\Category;
use App\Models\Product;
use App\Queries\Catalog\RecentSalesQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class PopularCategoryService
{
    public function __construct(private RecentSalesQuery $sales) {}

    /** @return Collection<int, Category> */
    public function get(): Collection
    {
        $available = static fn (Builder $products): Builder => $products->published()
            ->whereHas('offers', fn (Builder $offers): Builder => $offers->available());
        $categorySales = DB::table('category_product')
            ->joinSub($this->sales->byProduct(), 'product_sales', 'product_sales.product_id', '=', 'category_product.product_id')
            ->whereIn('category_product.product_id', $available(Product::query())->select('products.id'))
            ->groupBy('category_product.category_id')->select('category_product.category_id')
            ->selectRaw('SUM(product_sales.units_sold) AS units_sold');

        return Category::query()->select('categories.*')
            ->leftJoinSub($categorySales, 'category_sales', 'category_sales.category_id', '=', 'categories.id')
            ->whereHas('products', $available)->withCount(['products' => $available])
            ->orderByRaw('COALESCE(category_sales.units_sold, 0) DESC')
            ->orderByDesc('products_count')->orderBy('categories.name')->orderBy('categories.id')->limit(9)->get();
    }
}
