<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Casts\EncryptedValue;

class UserStat extends Model
{
    public $timestamps = false;
    public $incrementing = false;
    protected $primaryKey = 'user_id';

    protected $fillable = [
        'user_id',
        'notes_count',
        'expenses_total',
        'debts_owed_to_me',
        'debts_i_owe',
        'income_total',
        'files_count',
    ];

    protected $casts = [
        'notes_count'      => 'integer',
        'expenses_total'   => EncryptedValue::class,
        'debts_owed_to_me' => EncryptedValue::class,
        'debts_i_owe'      => EncryptedValue::class,
        'income_total'     => EncryptedValue::class,
        'files_count'      => 'integer',
    ];
}
