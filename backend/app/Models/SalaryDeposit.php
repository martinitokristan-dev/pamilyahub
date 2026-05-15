<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Casts\EncryptedValue;

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
            'amount'        => EncryptedValue::class,
            'already_spent' => EncryptedValue::class,
            'deposited_at'  => 'datetime',
            'is_delayed'    => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getAmountAsFloat(): float
    {
        return (float) $this->amount;
    }
}
