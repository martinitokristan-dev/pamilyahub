<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiTrainingLog extends Model
{
    protected $guarded = [];

    protected $casts = [
        'translated_entities' => 'array',
        'local_missed' => 'boolean',
        'reviewed' => 'boolean',
    ];
}
