<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\AiTrainingLog;

// 1. Insert test log
$testLog = AiTrainingLog::create([
    'input_text' => 'I yolod_test_xyz 500 pesos on lunch',
    'keyword' => 'yolod_test_xyz',
    'translated_intent' => 'log_expense',
    'local_missed' => true,
    'reviewed' => false,
]);

echo "Inserted test log ID: {$testLog->id}\n";
