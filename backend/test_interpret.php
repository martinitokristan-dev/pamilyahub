<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

// Let's authenticate a user
$user = \App\Models\User::first();
if (!$user) {
    echo "No user found in database. Let's create one.\n";
    $user = \App\Models\User::create([
        'name' => 'Marti Test',
        'email' => 'martinitokristan@gmail.com',
        'password' => bcrypt('password'),
    ]);
}
auth()->login($user);

echo "Testing Interpret API fallback with unrecognized expense verb...\n";

// We'll send an unrecognized input text like: "splurged 450 pesos on a fancy watch from cash"
// Let's create a request
$messageText = "splurged 450 pesos on a fancy watch from cash";
$request = \Illuminate\Http\Request::create('/api/chat/interpret', 'POST', [
    'message' => $messageText
]);

$response = app(App\Http\Controllers\ChatController::class)->interpret($request);
echo "Response Status: " . $response->getStatusCode() . "\n";
echo "Response JSON: " . $response->getContent() . "\n\n";

// Now, let's query the database to verify that reasoning is NOT NULL and is populated
$logs = \App\Models\AiTrainingLog::whereNotNull('reasoning')->latest()->limit(5)->get();
echo "Found " . $logs->count() . " logs with reasoning:\n";
foreach ($logs as $log) {
    echo "ID: " . $log->id . "\n";
    echo "Input: " . $log->input_text . "\n";
    echo "Reasoning: " . $log->reasoning . "\n";
    echo "Provider: " . $log->provider . "\n";
    echo "Keyword: " . $log->keyword . "\n";
    echo "----------------------------------------\n";
}
