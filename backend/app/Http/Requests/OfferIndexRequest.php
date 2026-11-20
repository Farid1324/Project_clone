<?php

namespace App\Http\Requests;

class OfferIndexRequest extends PaginationRequest
{
    public function rules(): array
    {
        return parent::rules() + [
            'product_id' => ['sometimes', 'uuid', 'exists:products,id'],
            'seller_id' => ['sometimes', 'uuid', 'exists:sellers,id'],
            'in_stock' => ['sometimes', 'boolean'],
        ];
    }
}
