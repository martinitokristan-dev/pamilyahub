<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Casts\EncryptedValue;

class UpcomingPayment extends Model
{
    use HasFactory;

    protected $table = 'upcoming_payments';

    protected $fillable = [
        'user_id',
        'wallet_id',
        'title',
        'amount',
        'description',
        'due_date',
        'is_paid',
        'paid_date',
        'category',
        'recurrence',
    ];

    protected $casts = [
        'amount'      => EncryptedValue::class,
        'title'       => EncryptedValue::class,
        'description' => EncryptedValue::class,
        'due_date'    => 'date:Y-m-d',
        'is_paid'     => 'boolean',
        'paid_date'   => 'date:Y-m-d',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class);
    }
}
