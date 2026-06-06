<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DebtResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'amount' => number_format((float) $this->amount, 2, '.', ','),
            'title' => $this->name, // Keep title for frontend template compatibility
            'description' => $this->name, // Schema specifies description as the main description/title
            'notes' => $this->description, // DB description/notes field
            'date' => $this->created_at instanceof \DateTimeInterface 
                ? $this->created_at->format('Y-m-d') 
                : substr((string)$this->created_at, 0, 10),
            'wallet' => null, // Debts typically don't belong to a single wallet until paid
            'type' => $this->type, // e.g. owed_to_me, i_owe
            'is_paid' => (bool) $this->is_paid,
            'is_settled' => (bool) $this->is_paid,
            'amount_paid' => number_format((float) ($this->amount_paid ?? 0), 2, '.', ','),
            'due_date' => $this->due_date,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
