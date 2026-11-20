<?php

namespace Database\Factories;

use App\Models\Promotion;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Promotion> */
class PromotionFactory extends Factory
{
    protected $model = Promotion::class;

    public function definition(): array
    {
        return ['slug' => 'promotion-'.Str::uuid(), 'title' => 'Demo promotion', 'description' => 'A scheduled collection of discounted offers.', 'image_path' => '/demo/banner-deals.svg', 'is_active' => true, 'starts_at' => now()->subDay(), 'ends_at' => now()->addMonth()];
    }
}
