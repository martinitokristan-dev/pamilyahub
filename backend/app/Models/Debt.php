<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Casts\EncryptedValue;

class Debt extends Model
{
    use HasFactory;

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
        'name'        => EncryptedValue::class,
        'amount'      => EncryptedValue::class,
        'description' => EncryptedValue::class,
        'due_date'    => 'date:Y-m-d',
        'is_paid'     => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getAmountAsFloat(): float
    {
        return (float) $this->amount;
    }
}
