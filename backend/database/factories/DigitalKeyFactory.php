<?php

namespace Database\Factories;

use App\Models\DigitalKey;
use App\Models\Offer;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<DigitalKey> */
class DigitalKeyFactory extends Factory
{
    protected $model = DigitalKey::class;

    public function definition(): array
    {
        return ['offer_id' => Offer::factory(), 'key_ciphertext' => 'DEMO-NOT-REDEEMABLE-'.Str::uuid(), 'order_item_id' => null, 'allocated_at' => null, 'retired_at' => null];
    }
}
