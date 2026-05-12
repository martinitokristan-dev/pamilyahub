<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

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
        'files_count',
    ];

    protected $casts = [
        'notes_count'      => 'integer',
        'expenses_total'   => 'float',
        'debts_owed_to_me' => 'float',
        'debts_i_owe'      => 'float',
        'files_count'      => 'integer',
    ];
}
