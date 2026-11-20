<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Order> */
class OrderFactory extends Factory
{
    protected $model = Order::class;

    public function definition(): array
    {
        return ['user_id' => User::factory(), 'idempotency_key' => Str::uuid(), 'request_hash' => hash('sha256', (string) Str::uuid()), 'status' => 'payment_failed', 'currency' => 'EUR', 'total_minor' => 0, 'fulfilled_at' => null];
    }
}
