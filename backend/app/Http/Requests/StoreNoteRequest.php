<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreNoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title'           => ['required', 'string', 'max:255'],
            'content'         => ['required', 'string'],
            'folder_id'       => ['nullable', 'exists:note_folders,id,user_id,' . auth()->id()],
            'is_prioritized'  => ['nullable', 'boolean'],
        ];
    }
}
