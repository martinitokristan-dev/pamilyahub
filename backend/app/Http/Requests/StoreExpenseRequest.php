<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title'          => ['required', 'string', 'max:255'],
            'amount'         => ['required', 'numeric', 'min:0'],
            'category'       => ['nullable', 'string', 'max:100'],
            'description'    => ['nullable', 'string'],
            'date'           => ['required', 'date'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'wallet_id'      => ['nullable', 'integer', 'exists:wallets,id'],
        ];
    }
}
