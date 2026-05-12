<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Debt extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'amount',
        'type',
        'description',
        'due_date',
        'is_paid',
    ];

    protected $casts = [
        'amount'   => 'decimal:2',
        'due_date' => 'date:Y-m-d',
        'is_paid'  => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
