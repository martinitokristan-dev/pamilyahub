<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\AiTrainingLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatRulesTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test chat/rules endpoint returns rules.
     */
    public function test_get_chat_rules_requires_authentication(): void
    {
        $response = $this->getJson('/api/chat/rules');
        $response->assertStatus(401);
    }

    /**
     * Test chat/rules endpoint merges reviewed logs.
     */
    public function test_get_chat_rules_returns_merged_rules_for_authenticated_user(): void
    {
        $user = User::factory()->create();

        // Create a reviewed log with a specific keyword
        $keyword = 'gastos_test_verb_123';
        AiTrainingLog::create([
            'input_text' => 'gastos_test_verb_123 500 grocery',
            'translated_intent' => 'log_expense',
            'keyword' => $keyword,
            'reasoning' => 'Test reasoning',
            'provider' => 'test',
            'reviewed' => true,
        ]);

        $response = $this->actingAs($user)->getJson('/api/chat/rules');
        $response->assertStatus(200);

        $data = $response->json();
        
        $this->assertIsArray($data);
        $this->assertArrayHasKey('expense_verbs', $data);
        
        // Assert the dynamic database keyword is in the merged results
        $this->assertTrue(in_array($keyword, $data['expense_verbs']));
    }
}
