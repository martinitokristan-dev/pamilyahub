<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreDebtRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'        => ['required', 'string', 'max:255'],
            'amount'      => ['required', 'numeric', 'min:0'],
            'type'        => ['required', 'in:owed_to_me,i_owe'],
            'description' => ['nullable', 'string'],
            'due_date'    => ['nullable', 'date'],
            'is_paid'     => ['sometimes', 'boolean'],
            'wallet_id'   => ['nullable', 'integer', 'exists:wallets,id'],
        ];
    }
}
