<?php

namespace App\Http\Requests;

class CheckoutRequest extends LoginRequest
{
    public function rules(): array
    {
        return ['quote_token' => ['required', 'string', 'max:30000'], 'idempotency_key' => ['required', 'uuid'], 'scenario' => ['required', 'in:approve,decline']];
    }
}
