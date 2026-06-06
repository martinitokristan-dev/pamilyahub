<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExpenseResource extends JsonResource
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
            'amount' => (float) $this->amount,
            'title' => $this->title, // Keep title for frontend template compatibility
            'description' => $this->title, // Schema specifies description as the main description/title
            'notes' => $this->description, // DB description/notes field
            'date' => $this->date instanceof \DateTimeInterface 
                ? $this->date->format('Y-m-d') 
                : substr((string)$this->date, 0, 10),
            'wallet' => $this->wallet, // Support both raw name lookup & full object for wallet icon
            'type' => 'expense',
            'wallet_id' => $this->wallet_id,
            'is_settled' => (bool) $this->is_settled,
            'settled_amount' => $this->settled_amount,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
