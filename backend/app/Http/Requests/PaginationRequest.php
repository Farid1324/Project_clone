<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class PaginationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['page' => ['sometimes', 'integer', 'min:1', 'max:100000'], 'per_page' => ['sometimes', 'integer', 'min:1', 'max:48']];
    }

    protected function prepareForValidation(): void
    {
        if (in_array($this->query('in_stock'), ['true', 'false'], true)) {
            $this->merge(['in_stock' => $this->query('in_stock') === 'true']);
        }
        if (is_string($this->query('q'))) {
            $this->merge(['q' => trim($this->query('q'))]);
        }
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            foreach (array_diff(array_keys($this->query()), array_keys($this->rules())) as $field) {
                $validator->errors()->add($field, 'This query parameter is not supported.');
            }
            if (is_numeric($this->input('price_min')) && is_numeric($this->input('price_max')) && $this->input('price_min') > $this->input('price_max')) {
                $validator->errors()->add('price_max', 'Maximum price must be at least minimum price.');
            }
        });
    }
}
