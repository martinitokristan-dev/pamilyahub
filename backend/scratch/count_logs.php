<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$totalUnreviewedLogs = \App\Models\AiTrainingLog::where('local_missed', true)
    ->where('reviewed', false)
    ->count();

$totalAllLogs = \App\Models\AiTrainingLog::count();

echo "Total unreviewed logs: " . $totalUnreviewedLogs . "\n";
echo "Total all logs: " . $totalAllLogs . "\n";
