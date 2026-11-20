<?php

namespace Database\Factories;

use App\Models\HomepageBanner;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<HomepageBanner> */
class HomepageBannerFactory extends Factory
{
    protected $model = HomepageBanner::class;

    public function definition(): array
    {
        return ['title' => 'Discover your next game', 'subtitle' => 'Independent sellers and instant demo delivery', 'image_path' => '/demo/banner-discover.svg', 'image_alt' => 'Original purple marketplace artwork', 'destination_type' => 'store', 'product_id' => null, 'sort_order' => 0, 'is_active' => true, 'starts_at' => now()->subDay(), 'ends_at' => now()->addMonth()];
    }
}
