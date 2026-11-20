<?php

namespace App\Services\Checkout;

class SimulatedPayment
{
    public function approve(string $scenario): bool
    {
        return $scenario === 'approve';
    }
}
