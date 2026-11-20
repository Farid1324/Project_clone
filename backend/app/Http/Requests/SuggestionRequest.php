<?php

namespace App\Http\Requests;

class SuggestionRequest extends PaginationRequest
{
    public function rules(): array
    {
        return ['q' => ['required', 'string', 'min:2', 'max:100'], 'limit' => ['sometimes', 'integer', 'min:1', 'max:8']];
    }
}
