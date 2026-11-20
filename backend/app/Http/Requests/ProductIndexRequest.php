<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class ProductIndexRequest extends PaginationRequest
{
    public function rules(): array
    {
        $rules = parent::rules() + [
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'type' => ['sometimes', Rule::in(['game', 'gift_card'])],
            'price_min' => ['sometimes', 'integer', 'min:0', 'max:2147483647'],
            'price_max' => ['sometimes', 'integer', 'min:0', 'max:2147483647'],
            'in_stock' => ['sometimes', 'boolean'],
            'promotion' => ['sometimes', 'string', 'max:120', 'exists:promotions,slug'],
            'sort' => ['sometimes', Rule::in(['relevance', 'price_asc', 'price_desc', 'title_asc', 'newest', 'popularity'])],
        ];
        foreach (['categories' => ['categories', 'slug'], 'platforms' => ['platforms', 'slug'], 'regions' => ['regions', 'code']] as $name => [$table, $column]) {
            $rules[$name] = ['sometimes', 'array', 'max:20'];
            $rules[$name.'.*'] = ['string', 'max:100', 'distinct', Rule::exists($table, $column)];
        }

        return $rules;
    }
}
