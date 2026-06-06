<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UpcomingPaymentArchive extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'id', // Original ID to prevent conflicts
        'user_id',
        'wallet_id',
        'title',
        'amount',
        'due_date',
        'description',
        'is_paid',
        'paid_date',
        'category',
        'created_at',
        'updated_at',
        'archived_at'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function wallet()
    {
        return $this->belongsTo(Wallet::class);
    }
}
