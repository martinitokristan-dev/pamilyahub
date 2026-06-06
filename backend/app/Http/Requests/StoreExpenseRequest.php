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
            'description'    => ['nullable', 'string'],
            'date'           => ['required', 'date'],
            'wallet_id'      => ['nullable', 'integer', 'exists:wallets,id'],
        ];
    }
}
