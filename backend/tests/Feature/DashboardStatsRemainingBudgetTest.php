<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Wallet;
use App\Models\Income;
use App\Models\Expense;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardStatsRemainingBudgetTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test Case 1: Month Boundary
     * User has ₱150,000 in wallets at the start of June (before any deposits).
     * Expected: remaining_salary should be ₱150,000 (actual wallet balance)
     * Bug: Will return ₱0 (monthly income - monthly expenses = 0 - 0)
     * 
     * **Validates: Requirements 1.1, 2.1**
     */
    public function test_remaining_salary_at_month_boundary_with_wallet_balance(): void
    {
        $user = User::factory()->create();
        
        // Create wallets totaling ₱150,000
        Wallet::create([
            'user_id' => $user->id,
            'balance' => 100000,
            'name' => 'Main Wallet',
            'type' => 'cash',
            'color' => '#4CAF50'
        ]);
        Wallet::create([
            'user_id' => $user->id,
            'balance' => 50000,
            'name' => 'Savings Wallet',
            'type' => 'savings',
            'color' => '#2196F3'
        ]);

        // Query for June 1st (no income or expenses yet this month)
        $response = $this->actingAs($user)->getJson('/api/dashboard/stats?month=6&year=2024');
        
        $response->assertStatus(200);
        
        $data = $response->json('data');
        
        // Calculate expected value: SUM(wallet.balance)
        $expectedRemainingSalary = 150000.0;
        
        // CRITICAL: This assertion will FAIL on unfixed code
        // Unfixed code returns: 0 - 0 = 0
        // Fixed code should return: 150000
        $this->assertEquals(
            $expectedRemainingSalary, 
            $data['remaining_salary'],
            "remaining_salary should equal sum of wallet balances (₱150,000), not monthly calculation (₱0)"
        );
        
        // Verify monthly income and expenses are still calculated correctly
        $this->assertEquals(0.0, $data['monthly_income']);
        $this->assertEquals(0.0, $data['monthly_expenses']);
    }

    /**
     * Test Case 2: Pre-Salary Spending
     * User starts with ₱150,000, spends ₱20,000 before salary deposit in June.
     * Expected: remaining_salary should be ₱130,000 (current wallet balance)
     * Bug: Will return -₱20,000 (monthly income - monthly expenses = 0 - 20000)
     * 
     * **Validates: Requirements 1.2, 2.2**
     */
    public function test_remaining_salary_with_pre_salary_spending(): void
    {
        $user = User::factory()->create();
        
        // Create wallets totaling ₱130,000 (after spending ₱20k from ₱150k)
        Wallet::create([
            'user_id' => $user->id,
            'balance' => 80000,
            'name' => 'Main Wallet',
            'type' => 'cash',
            'color' => '#4CAF50'
        ]);
        Wallet::create([
            'user_id' => $user->id,
            'balance' => 50000,
            'name' => 'Savings Wallet',
            'type' => 'savings',
            'color' => '#2196F3'
        ]);

        // Add June expenses (₱20,000 spent)
        Expense::create([
            'user_id' => $user->id,
            'amount' => 20000,
            'date' => '2024-06-05',
            'is_settled' => false,
            'title' => 'Groceries',
            'description' => 'Groceries before salary'
        ]);

        // No June income yet (before salary deposit)
        
        // Query for June 5th
        $response = $this->actingAs($user)->getJson('/api/dashboard/stats?month=6&year=2024');
        
        $response->assertStatus(200);
        
        $data = $response->json('data');
        
        // Calculate expected value: SUM(wallet.balance)
        $expectedRemainingSalary = 130000.0;
        
        // CRITICAL: This assertion will FAIL on unfixed code
        // Unfixed code returns: 0 - 20000 = -20000
        // Fixed code should return: 130000
        $this->assertEquals(
            $expectedRemainingSalary, 
            $data['remaining_salary'],
            "remaining_salary should equal sum of wallet balances (₱130,000), not monthly calculation (-₱20,000)"
        );
        
        // Verify monthly calculations are correct
        $this->assertEquals(0.0, $data['monthly_income']);
        $this->assertEquals(20000.0, $data['monthly_expenses']);
    }

    /**
     * Test Case 3: User Evidence
     * Real user scenario: ₱327,083 in wallets, ₱13,070 June income, ₱11,327 June expenses.
     * Expected: remaining_salary should be ₱327,083 (actual available funds)
     * Bug: Will return ₱1,743 (monthly income - monthly expenses = 13070 - 11327)
     * 
     * **Validates: Requirements 1.3, 1.4, 2.3, 2.4**
     */
    public function test_remaining_salary_matches_user_evidence_scenario(): void
    {
        $user = User::factory()->create();
        
        // Create wallets totaling ₱327,083 (cumulative balance)
        Wallet::create([
            'user_id' => $user->id,
            'balance' => 200000,
            'name' => 'Main Wallet',
            'type' => 'cash',
            'color' => '#4CAF50'
        ]);
        Wallet::create([
            'user_id' => $user->id,
            'balance' => 100000,
            'name' => 'Savings Wallet',
            'type' => 'savings',
            'color' => '#2196F3'
        ]);
        Wallet::create([
            'user_id' => $user->id,
            'balance' => 27083,
            'name' => 'Emergency Fund',
            'type' => 'savings',
            'color' => '#FF9800'
        ]);

        // Add June income (₱13,070)
        Income::create([
            'user_id' => $user->id,
            'amount' => 13070,
            'date' => '2024-06-15',
            'source' => 'Side Gig',
            'description' => 'Side income'
        ]);

        // Add June expenses (₱11,327)
        Expense::create([
            'user_id' => $user->id,
            'amount' => 11327,
            'date' => '2024-06-15',
            'is_settled' => false,
            'title' => 'Monthly expenses',
            'description' => 'Monthly expenses'
        ]);

        // Query for June
        $response = $this->actingAs($user)->getJson('/api/dashboard/stats?month=6&year=2024');
        
        $response->assertStatus(200);
        
        $data = $response->json('data');
        
        // Calculate expected value: SUM(wallet.balance)
        $expectedRemainingSalary = 327083.0;
        
        // CRITICAL: This assertion will FAIL on unfixed code
        // Unfixed code returns: 13070 - 11327 = 1743
        // Fixed code should return: 327083
        $this->assertEquals(
            $expectedRemainingSalary, 
            $data['remaining_salary'],
            "remaining_salary should equal sum of wallet balances (₱327,083), not monthly calculation (₱1,743). " .
            "This is the actual user evidence case where EleFam AI said 'budget almost gone' incorrectly."
        );
        
        // Verify monthly calculations are correct
        $this->assertEquals(13070.0, $data['monthly_income']);
        $this->assertEquals(11327.0, $data['monthly_expenses']);
    }

    /**
     * Test Case 4: No Wallets (Edge Case)
     * User has no wallets created yet.
     * Expected: remaining_salary should be ₱0
     * This test should PASS both before and after the fix.
     * 
     * **Validates: Requirements 2.1**
     */
    public function test_remaining_salary_with_no_wallets(): void
    {
        $user = User::factory()->create();
        
        // No wallets created
        
        // Add some income and expenses for completeness
        Income::create([
            'user_id' => $user->id,
            'amount' => 5000,
            'date' => '2024-06-15',
            'source' => 'Test Income',
            'description' => 'Some income'
        ]);

        Expense::create([
            'user_id' => $user->id,
            'amount' => 3000,
            'date' => '2024-06-15',
            'is_settled' => false,
            'title' => 'Test Expense',
            'description' => 'Some expense'
        ]);

        // Query for June
        $response = $this->actingAs($user)->getJson('/api/dashboard/stats?month=6&year=2024');
        
        $response->assertStatus(200);
        
        $data = $response->json('data');
        
        // Calculate expected value: SUM(wallet.balance) = 0 (no wallets)
        $expectedRemainingSalary = 0.0;
        
        // This should pass both before and after fix
        // Unfixed code returns: 5000 - 3000 = 2000
        // Fixed code returns: 0 (no wallets)
        // NOTE: This will actually FAIL on unfixed code too, proving the bug
        $this->assertEquals(
            $expectedRemainingSalary, 
            $data['remaining_salary'],
            "remaining_salary should be ₱0 when user has no wallets"
        );
        
        // Verify monthly calculations are correct
        $this->assertEquals(5000.0, $data['monthly_income']);
        $this->assertEquals(3000.0, $data['monthly_expenses']);
    }
}
