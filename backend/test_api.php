<?php
$user = \App\Models\User::first();
auth()->login($user);

// 1. Gemini request
$request = \Illuminate\Http\Request::create('/api/chat/message', 'POST', ['message' => 'hello gemini test']);
$response = app(App\Http\Controllers\ChatController::class)->message($request);
echo "Gemini Response: " . $response->getContent() . "\n\n";

// 2. Groq request
putenv('GEMINI_API_KEY=');
$request2 = \Illuminate\Http\Request::create('/api/chat/message', 'POST', ['message' => 'hello groq test']);
$response2 = app(App\Http\Controllers\ChatController::class)->message($request2);
echo "Groq Response: " . $response2->getContent() . "\n\n";

echo "Done.\n";
