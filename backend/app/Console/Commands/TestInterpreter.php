<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Models\UpcomingPayment;
use App\Models\Debt;

class TestInterpreter extends Command
{
    protected $signature = 'app:test-interpreter';
    protected $description = 'Tests the AI Interpreter disambiguation rules';

    public function handle()
    {
        $user = User::where('email', 'martinitokristan@gmail.com')->first();
        if (!$user) {
            $this->error("Test user not found");
            return;
        }

        // Setup mock data
        UpcomingPayment::where('user_id', $user->id)->delete();
        Debt::where('user_id', $user->id)->delete();

        UpcomingPayment::create([
            'user_id' => $user->id,
            'title' => 'Netflix',
            'amount' => 500,
            'due_date' => '2026-06-30',
            'category' => 'Streaming',
            'is_paid' => false,
        ]);

        Debt::create([
            'user_id' => $user->id,
            'name' => 'Ana',
            'amount' => 300,
            'type' => 'i_owe',
        ]);

        $testCases = [
            "add a plan for spotify 150 every month" => "create_plan",
            "I paid netflix 500 from gcash" => "pay_plan",
            "show my upcoming plans" => "view_plans",
            "I need to pay the Meralco bill 1000 due tomorrow" => "create_plan",
            "add a plan for rent 5000 due June 30" => "create_plan",
            "pay Ana 300 from gcash" => "pay_debt", // Ensure it doesn't match pay_plan
        ];

        $this->info("Running AI Interpreter Tests...");

        foreach ($testCases as $input => $expectedAction) {
            $this->info("\nTesting: '$input'");

            // Prepare context
            $plans = UpcomingPayment::where('user_id', $user->id)
                ->where('is_paid', false)
                ->get(['id', 'title', 'amount', 'due_date']);
                
            $debts = Debt::where('user_id', $user->id)
                ->get(['id', 'name', 'amount', 'type']);

            $systemPrompt = "You are a JSON interpreter.\n"
                . "- Upcoming Plans:\n" . json_encode($plans) . "\n"
                . "- Active Debts:\n" . json_encode($debts) . "\n"
                . "Extract the user's intent. Output JSON strictly with keys: action, amount, reason, date. "
                . "Actions can be: create_plan, pay_plan, view_plans, pay_debt, create_debt. "
                . "If the user is paying someone in Active Debts, use pay_debt. If paying an Upcoming Plan, use pay_plan.";

            $apiKey = env('GEMINI_API_KEY_1');
            $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" . $apiKey;

            $payload = [
                "system_instruction" => [
                    "parts" => [["text" => $systemPrompt]]
                ],
                "contents" => [
                    [
                        "role" => "user",
                        "parts" => [["text" => $input]]
                    ]
                ],
                "generationConfig" => [
                    "temperature" => 0,
                    "topK" => 1,
                    "topP" => 0.1,
                ]
            ];

            try {
                $response = \Illuminate\Support\Facades\Http::timeout(10)->post($url, $payload);
                if (!$response->successful()) {
                    $this->error("API Error: " . $response->body());
                    continue;
                }

                $data = $response->json();
                $responseText = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
                
                // Extract JSON block if surrounded by markdown
                $jsonText = $responseText;
                if (preg_match('/```json\s*(.*?)\s*```/s', $responseText, $matches)) {
                    $jsonText = $matches[1];
                }

                $parsed = json_decode($jsonText, true);
                $action = $parsed['action'] ?? 'UNKNOWN';

                if ($action === $expectedAction) {
                    $this->info("✓ PASSED: Got '$action'");
                } else {
                    $this->error("✗ FAILED: Expected '$expectedAction', got '$action'. Response: $jsonText");
                }
            } catch (\Exception $e) {
                $this->error("Exception: " . $e->getMessage());
            }
        }
        
        $this->info("\nTests completed.");
    }
}
