<?php

namespace Database\Factories;

use App\Models\Platform;
use App\Models\Product;
use App\Models\Region;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Product> */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        $title = fake()->unique()->words(4, true);

        return ['platform_id' => Platform::factory(), 'region_id' => Region::factory(), 'title' => $title, 'slug' => Str::slug($title), 'type' => 'game', 'edition' => 'Standard', 'description' => fake()->paragraph(), 'cover_image_path' => '/demo/generic.svg', 'publisher' => 'Demo Publisher', 'release_date' => '2023-01-01', 'is_active' => true];
    }
}
