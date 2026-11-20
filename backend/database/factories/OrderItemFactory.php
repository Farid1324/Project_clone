<?php

namespace Database\Factories;

use App\Models\Offer;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<OrderItem> */
class OrderItemFactory extends Factory
{
    protected $model = OrderItem::class;

    public function definition(): array
    {
        return ['order_id' => Order::factory(), 'offer_id' => Offer::factory(), 'product_title_snapshot' => 'Purchased demo title', 'seller_name_snapshot' => 'Demo seller', 'platform_name_snapshot' => 'Demo platform', 'region_name_snapshot' => 'Global', 'unit_price_minor' => 1999, 'quantity' => 1];
    }
}
