<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Casts\EncryptedValue;

class ExpenseArchive extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'wallet_id',
        'title',
        'amount',
        'description',
        'date',
        'is_settled',
        'settled_amount',
        'archived_at',
    ];

    protected $casts = [
        'amount'         => EncryptedValue::class,
        'title'          => EncryptedValue::class,
        'description'    => EncryptedValue::class,
        'date'           => 'date:Y-m-d',
        'is_settled'     => 'boolean',
        'settled_amount' => 'decimal:2',
        'archived_at'    => 'datetime',
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
