<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function failedValidation(\Illuminate\Contracts\Validation\Validator $validator)
    {
        \Log::error('Expense validation failed', [
            'errors' => $validator->errors()->toArray(),
            'data' => $this->all()
        ]);
        parent::failedValidation($validator);
    }

    public function rules(): array
    {
        return [
            'title'          => ['required', 'string', 'max:255'],
            'amount'         => ['required', 'numeric', 'min:0.01'],
            'description'    => ['nullable', 'string'],
            'date'           => ['required', 'date'],
            'wallet_id'      => ['nullable', 'integer', \Illuminate\Validation\Rule::exists('wallets', 'id')->where('user_id', auth()->id())],
            // Receipt items validation
            'receipt_items'                    => ['nullable', 'array'],
            'receipt_items.items'              => ['sometimes', 'array'],
            'receipt_items.items.*.itemName'   => ['required', 'string'],
            'receipt_items.items.*.quantity'   => ['required', 'integer', 'min:1'],
            'receipt_items.items.*.unitPrice'  => ['required', 'numeric', 'min:0'],
            'receipt_items.items.*.subtotal'   => ['required', 'numeric', 'min:0'],
            'receipt_items.items.*.type'       => ['required', 'string'],
            'receipt_items.fees'               => ['sometimes', 'array'],
            'receipt_items.fees.*.itemName'    => ['required', 'string'],
            'receipt_items.fees.*.quantity'    => ['required', 'integer', 'min:1'],
            'receipt_items.fees.*.unitPrice'   => ['required', 'numeric', 'min:0'],
            'receipt_items.fees.*.subtotal'    => ['required', 'numeric', 'min:0'],
            'receipt_items.fees.*.type'        => ['required', 'string'],
            'receipt_items.itemsSubtotal'      => ['sometimes', 'numeric', 'min:0'],
            'receipt_items.feesSubtotal'       => ['sometimes', 'numeric', 'min:0'],
            'receipt_items.total'              => ['sometimes', 'numeric', 'min:0'],
            'receipt_items.itemCount'          => ['sometimes', 'integer', 'min:0'],
            'receipt_items.feeCount'           => ['sometimes', 'integer', 'min:0'],
            'receipt_items.merchantName'       => ['sometimes', 'string'],
            'receipt_items.scannedAt'          => ['sometimes', 'string'],
        ];
    }
}
