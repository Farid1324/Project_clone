<?php

namespace App\Queries\Catalog;

use App\Models\Product;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class ProductQuery
{
    public function __construct(private RecentSalesQuery $sales) {}

    public function cards(?Closure $offerFilter = null, bool $publishedOnly = true): Builder
    {
        $offerFilter ??= fn (Builder $offers): Builder => $offers->available();

        return Product::query()->when($publishedOnly, fn (Builder $query): Builder => $query->published())->select('products.*')
            ->with(['platform', 'region', 'categories', 'offers' => function (HasMany $offers) use ($offerFilter): void {
                $offerFilter($offers->getQuery());
                $offers->with(['seller', 'promotions' => fn (BelongsToMany $promotion): BelongsToMany => $promotion->active()])
                    ->withCount('availableKeys')->orderBy('offers.price_minor')->orderBy('offers.id');
            }])
            ->withMin(['offers as lowest_price' => $offerFilter], 'price_minor');
    }

    public function paginate(array $filters, int $perPage): LengthAwarePaginator
    {
        return $this->read($filters, fn (Builder $query): LengthAwarePaginator => $query->paginate($perPage));
    }

    public function suggestions(string $term, int $limit): Collection
    {
        return $this->read(['q' => $term, 'sort' => 'relevance'], fn (Builder $query): Collection => $query->limit($limit)->get());
    }

    /** Keep relevance settings local to this read, including pooled connections. */
    private function read(array $filters, Closure $result): mixed
    {
        $operation = fn (): mixed => $result($this->listing($filters));
        if (($filters['q'] ?? '') === '') {
            return $operation();
        }

        return DB::transaction(function () use ($operation): mixed {
            $settings = DB::selectOne("SELECT COALESCE(current_setting('pg_trgm.similarity_threshold', true), '0.3') AS similarity, COALESCE(current_setting('pg_trgm.word_similarity_threshold', true), '0.6') AS word_similarity");
            DB::statement('SET LOCAL pg_trgm.similarity_threshold = 0.3');
            DB::statement('SET LOCAL pg_trgm.word_similarity_threshold = 0.4');

            $result = $operation();
            DB::selectOne("SELECT set_config('pg_trgm.similarity_threshold', ?, true), set_config('pg_trgm.word_similarity_threshold', ?, true)", [$settings->similarity, $settings->word_similarity]);

            return $result;
        });
    }

    private function listing(array $filters): Builder
    {
        $offerFilter = function (Builder $offers) use ($filters): Builder {
            $offers->available();
            if (isset($filters['price_min'])) {
                $offers->where('price_minor', '>=', $filters['price_min']);
            }
            if (isset($filters['price_max'])) {
                $offers->where('price_minor', '<=', $filters['price_max']);
            }
            if (isset($filters['promotion'])) {
                $offers->whereHas('promotions', fn (Builder $promotion): Builder => $promotion->active()->where('slug', $filters['promotion']));
            }

            return $offers;
        };
        $query = $this->cards($offerFilter);
        if (($filters['in_stock'] ?? true) || isset($filters['price_min']) || isset($filters['price_max']) || isset($filters['promotion'])) {
            $query->whereHas('offers', $offerFilter);
        }
        foreach (['categories' => ['categories', 'slug'], 'platforms' => ['platform', 'slug'], 'regions' => ['region', 'code']] as $key => [$relation, $column]) {
            if (! empty($filters[$key])) {
                $query->whereHas($relation, fn (Builder $facet): Builder => $facet->whereIn($column, $filters[$key]));
            }
        }
        if (isset($filters['type'])) {
            $query->where('type', $filters['type']);
        }
        $search = mb_strtolower($filters['q'] ?? '');
        $sort = $filters['sort'] ?? ($search !== '' ? 'relevance' : 'newest');
        if ($search !== '') {
            $this->search($query, $search, $sort === 'relevance');
        }
        if ($sort === 'popularity') {
            $query->leftJoinSub($this->sales->byProduct(), 'catalog_sales', 'catalog_sales.product_id', '=', 'products.id')
                ->orderByRaw('COALESCE(catalog_sales.units_sold, 0) DESC');
        }
        match ($sort) {
            'price_asc' => $query->orderByRaw('lowest_price ASC NULLS LAST'),
            'price_desc' => $query->orderByRaw('lowest_price DESC NULLS LAST'),
            'title_asc' => $query->orderByRaw('lower(products.title) ASC'),
            'popularity' => $query->orderByDesc('products.created_at'),
            'relevance' => $search === '' ? $query->orderByDesc('products.created_at') : $query,
            default => $query->orderByDesc('products.created_at'),
        };

        return $query->orderBy('products.id');
    }

    private function search(Builder $query, string $term, bool $rank): void
    {
        $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $term);
        $prefix = $escaped.'%';
        $substring = '%'.$escaped.'%';
        $short = mb_strlen($term) < 3;
        $query->where(function (Builder $candidate) use ($term, $prefix, $substring, $short): void {
            $candidate->whereRaw('lower(products.title) LIKE ?', [$short ? $prefix : $substring]);
            if (! $short) {
                $candidate->orWhereRaw('lower(products.title) % ?', [$term])
                    ->orWhereRaw('lower(products.title) %> ?', [$term]);
            }
        });
        if ($rank) {
            $query->orderByRaw('CASE WHEN lower(products.title) = ? THEN 0 WHEN lower(products.title) LIKE ? THEN 1 WHEN lower(products.title) LIKE ? THEN 2 ELSE 3 END', [$term, $prefix, $substring])
                ->orderByRaw('word_similarity(?, lower(products.title)) DESC', [$term]);
        }
    }
}
