<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$logs = \DB::table('ai_training_logs')
    ->select('id', 'input_text', 'created_at')
    ->orderBy('id', 'asc')
    ->get();

$out = "";
foreach ($logs as $log) {
    $out .= "ID: {$log->id} | Created: {$log->created_at} | Input: {$log->input_text}\n";
}
file_put_contents('logs_list.txt', $out);
echo "Wrote to logs_list.txt\n";

