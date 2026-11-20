<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\PaymentAttempt;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<PaymentAttempt> */
class PaymentAttemptFactory extends Factory
{
    protected $model = PaymentAttempt::class;

    public function definition(): array
    {
        return ['order_id' => Order::factory(), 'provider' => 'simulated', 'scenario' => 'decline', 'status' => 'declined', 'reference' => Str::uuid(), 'amount_minor' => 0];
    }
}
