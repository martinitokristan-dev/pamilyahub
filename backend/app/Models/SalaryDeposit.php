<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalaryDeposit extends Model
{
    protected $fillable = [
        'user_id',
        'amount',
        'already_spent',
        'month',
        'year',
        'deposited_at',
        'is_delayed',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount'        => 'decimal:2',
            'already_spent' => 'decimal:2',
            'deposited_at'  => 'datetime',
            'is_delayed'    => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
