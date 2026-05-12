<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreWalletRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'    => ['required', 'string', 'max:100'],
            'type'    => ['required', 'string', 'max:50'],
            'balance' => ['required', 'numeric', 'min:0'],
            'color'   => ['nullable', 'string', 'max:20'],
        ];
    }
}
