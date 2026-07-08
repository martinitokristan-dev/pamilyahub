<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreTransferRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'from_wallet_id' => [
                'required',
                'integer',
                \Illuminate\Validation\Rule::exists('wallets', 'id')->where('user_id', auth()->id())
            ],
            'to_wallet_id' => [
                'required',
                'integer',
                \Illuminate\Validation\Rule::exists('wallets', 'id')->where('user_id', auth()->id())
            ],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'date' => ['required', 'date'],
            'description' => ['nullable', 'string'],
        ];
    }
}
