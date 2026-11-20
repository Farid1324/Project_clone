<?php

namespace Database\Factories;

use App\Models\DigitalKey;
use App\Models\Offer;
use App\Models\Product;
use App\Models\Seller;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Offer> */
class OfferFactory extends Factory
{
    protected $model = Offer::class;

    public function definition(): array
    {
        return ['product_id' => Product::factory(), 'seller_id' => Seller::factory(), 'price_minor' => 1999, 'comparison_price_minor' => 2999, 'currency' => 'EUR', 'is_active' => true];
    }

    public function inStock(int $quantity = 3): static
    {
        return $this->has(DigitalKey::factory()->count($quantity), 'digitalKeys');
    }
}
