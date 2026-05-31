<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\AiTrainingLog;

// 1. Verify and delete from DB
$log = AiTrainingLog::find(251);
if ($log) {
    echo "Found test log ID 251. Reviewed status: " . ($log->reviewed ? 'TRUE' : 'FALSE') . "\n";
    $log->delete();
    echo "Deleted test log ID 251 from DB.\n";
} else {
    echo "Test log ID 251 not found!\n";
}

// 2. Verify and remove from chatRules.json
$filePath = base_path('../frontend/src/lib/chatRules.json');
if (file_exists($filePath)) {
    $rules = json_decode(file_get_contents($filePath), true);
    if (isset($rules['expense_verbs'])) {
        $key = array_search('yolod_test_xyz', $rules['expense_verbs']);
        if ($key !== false) {
            echo "Found keyword 'yolod_test_xyz' in chatRules.json. Removing...\n";
            unset($rules['expense_verbs'][$key]);
            $rules['expense_verbs'] = array_values($rules['expense_verbs']);
            file_put_contents(
                $filePath,
                json_encode($rules, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            );
            echo "Successfully cleaned up chatRules.json.\n";
        } else {
            echo "Keyword 'yolod_test_xyz' NOT found in chatRules.json!\n";
        }
    }
}
