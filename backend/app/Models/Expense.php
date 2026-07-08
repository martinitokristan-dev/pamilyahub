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
        'is_settled',
        'settled_amount',
        'receipt_items', // NEW
    ];

    protected $casts = [
        'amount'         => EncryptedValue::class,
        'title'          => EncryptedValue::class,
        'description'    => EncryptedValue::class,
        'date'           => 'date:Y-m-d',
        'is_settled'     => 'boolean',
        'settled_amount' => 'decimal:2',
        'receipt_items'  => 'array', // NEW: Auto JSON encode/decode
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

    /**
     * Get the item count from receipt items
     */
    public function getItemCountAttribute(): ?int
    {
        if (!$this->receipt_items || !isset($this->receipt_items['itemCount'])) {
            return null;
        }
        return $this->receipt_items['itemCount'];
    }

    /**
     * Check if expense is from scanned receipt
     */
    public function getIsScannedAttribute(): bool
    {
        return !empty($this->receipt_items);
    }
}
