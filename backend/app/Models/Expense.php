<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Casts\EncryptedValue;

class Expense extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'wallet_id',
        'title',
        'amount',
        'description',
        'date',
        'payment_method',
        'is_settled',
    ];

    protected $casts = [
        'amount'      => EncryptedValue::class,
        'title'       => EncryptedValue::class,
        'description' => EncryptedValue::class,
        'date'        => 'date:Y-m-d',
        'is_settled'  => 'boolean',
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
