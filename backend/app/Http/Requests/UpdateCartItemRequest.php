<?php

namespace App\Http\Requests;

class UpdateCartItemRequest extends AddCartItemRequest
{
    public function rules(): array
    {
        return ['quantity' => ['required', 'integer', 'min:1', 'max:9']];
    }
}
