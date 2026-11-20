<?php

namespace Database\Factories;

use App\Models\Cart;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Cart> */
class CartFactory extends Factory
{
    protected $model = Cart::class;

    public function definition(): array
    {
        return ['user_id' => null, 'version' => 1];
    }

    public function owned(): static
    {
        return $this->state(fn (): array => ['user_id' => User::factory()]);
    }
}
