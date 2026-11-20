<?php

namespace App\Queries\Catalog;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class RecentSalesQuery
{
    /** Quantities, not order counts; failed, old and future orders are excluded. */
    public function byProduct(): Builder
    {
        return DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('offers', 'offers.id', '=', 'order_items.offer_id')
            ->where('orders.status', 'fulfilled')
            ->whereBetween('orders.fulfilled_at', [now()->subDays(30), now()])
            ->groupBy('offers.product_id')->select('offers.product_id')
            ->selectRaw('SUM(order_items.quantity) AS units_sold');
    }
}
