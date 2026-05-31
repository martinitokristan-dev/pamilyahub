<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

// Let's get the training sentences from marti_training_sentences.md
$content = file_get_contents('d:/PamilyaHub/frontend/marti_training_sentences.md');
$lines = explode("\n", $content);
$sentences = [];
foreach ($lines as $line) {
    if (preg_match('/^\s*\d+\.\s*(.*)/', $line, $matches)) {
        $sentences[] = trim($matches[1]);
    }
}
$logExpenseSentences = array_slice($sentences, 0, 150);

echo "Total parsed log expense sentences: " . count($logExpenseSentences) . "\n";

// Let's check how many times each log expense sentence is logged in ai_training_logs since 2026-05-30 21:00:00 (UTC)
$logs = \DB::table('ai_training_logs')
    ->where('created_at', '>=', '2026-05-30 21:00:00')
    ->get();

echo "Total log entries created in this session: " . count($logs) . "\n";

$mapped = [];
$duplicates = [];
$not_found = [];
foreach ($logExpenseSentences as $idx => $s) {
    $num = $idx + 1;
    $matches = $logs->filter(function($log) use ($s) {
        return strtolower(trim($log->input_text)) === strtolower(trim($s));
    });
    if ($matches->count() > 0) {
        $mapped[$num] = $matches->count();
        if ($matches->count() > 1) {
            $duplicates[$num] = [
                'sentence' => $s,
                'count' => $matches->count(),
                'ids' => $matches->pluck('id')->toArray()
            ];
        }
    } else {
        $not_found[$num] = $s;
    }
}

echo "Unique sentences logged: " . count($mapped) . "/150\n";
echo "Sentences logged more than once (duplicates): " . count($duplicates) . "\n";
print_r($duplicates);
echo "Sentences NOT logged: " . count($not_found) . "\n";
print_r($not_found);
