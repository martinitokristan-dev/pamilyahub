<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Casts\EncryptedValue;

class IncomeArchive extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'wallet_id',
        'source',
        'amount',
        'date',
        'description',
        'archived_at',
    ];

    protected $casts = [
        'amount'      => EncryptedValue::class,
        'source'      => EncryptedValue::class,
        'description' => EncryptedValue::class,
        'date'        => 'date',
        'archived_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class);
    }

    public function getAmountAsFloat(): float
    {
        return (float) $this->amount;
    }
}
