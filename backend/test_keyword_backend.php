<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Http\Controllers\ChatController;

$controller = new ChatController();
$reflection = new ReflectionClass(ChatController::class);
$method = $reflection->getMethod('extractKeyword');
$method->setAccessible(true);

$testCases = [
    [
        'input' => "splurged 450 pesos on a fancy watch from cash",
        'action' => "log_expense",
        'expected' => "splurged"
    ],
    [
        'input' => "accidentally wasted 200 on snacks using Maya",
        'action' => "log_expense",
        'expected' => "wasted"
    ],
    [
        'input' => "I blew 500 pesos on a nice pair of shoes",
        'action' => "log_expense",
        'expected' => "blew"
    ],
    [
        'input' => "nigasto ko og 300 para sa pagkaon",
        'action' => "log_expense",
        'expected' => "nigasto"
    ],
    [
        'input' => "shelled out 1k for groceries via BPI",
        'action' => "log_expense",
        'expected' => "shelled"
    ]
];

$allPassed = true;
foreach ($testCases as $case) {
    $result = $method->invokeArgs($controller, [$case['input'], $case['action']]);
    $status = ($result === $case['expected']) ? "PASS" : "FAIL";
    if ($status === "FAIL") {
        $allPassed = false;
    }
    echo "[{$status}] Input: \"{$case['input']}\" => Extracted: \"{$result}\" (Expected: \"{$case['expected']}\")\n";
}

if ($allPassed) {
    echo "\nAll keyword extraction tests passed successfully!\n";
} else {
    echo "\nSome keyword extraction tests failed.\n";
}
