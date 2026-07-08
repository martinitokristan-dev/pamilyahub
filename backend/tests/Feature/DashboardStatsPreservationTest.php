<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Wallet;
use App\Models\Income;
use App\Models\IncomeArchive;
use App\Models\Expense;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Preservation Property Tests
 * 
 * These tests capture baseline behavior that MUST remain unchanged after the fix.
 * All tests MUST PASS on unfixed code to document what should be preserved.
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */
class DashboardStatsPreservationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test Case 1: Monthly Income Preservation
     * 
     * Verifies that monthly_income continues to sum from incomes and income_archives
     * tables for the selected month/year, unchanged by the remaining_salary fix.
     * 
     * **Property 2: Preservation** - Monthly Statistics Unchanged
     * **Validates: Requirements 3.1, 3.6**
     */
    public function test_monthly_income_sums_from_incomes_and_archives_for_selected_month(): void
    {
        $user = User::factory()->create();
        
        // Create wallet (needed for income entries)
        Wallet::create([
            'user_id' => $user->id,
            'balance' => 50000,
            'name' => 'Main Wallet',
            'type' => 'cash',
            'color' => '#4CAF50'
        ]);

        // Add June income from incomes table
        Income::create([
            'user_id' => $user->id,
            'amount' => 10000,
            'date' => '2024-06-10',
            'source' => 'Salary',
            'description' => 'Monthly salary'
        ]);
        Income::create([
            'user_id' => $user->id,
            'amount' => 3070,
            'date' => '2024-06-15',
            'source' => 'Side Gig',
            'description' => 'Freelance work'
        ]);

        // Add June income from income_archives table
        IncomeArchive::create([
            'user_id' => $user->id,
            'amount' => 5000,
            'date' => '2024-06-20',
            'source' => 'Bonus',
            'description' => 'Performance bonus',
            'archived_at' => now()
        ]);

        // Add income from different month (should NOT be included)
        Income::create([
            'user_id' => $user->id,
            'amount' => 99999,
            'date' => '2024-05-15',
            'source' => 'May Income',
            'description' => 'Should not be counted'
        ]);

        // Query for June 2024
        $response = $this->actingAs($user)->getJson('/api/dashboard/stats?month=6&year=2024');
        
        $response->assertStatus(200);
        
        $data = $response->json('data');
        
        // Expected: SUM of June incomes from both tables
        $expectedMonthlyIncome = 10000.0 + 3070.0 + 5000.0; // = 18070
        
        // This MUST pass on unfixed code - preserves existing calculation
        $this->assertEquals(
            $expectedMonthlyIncome, 
            $data['monthly_income'],
            "monthly_income should sum from incomes + income_archives for selected month (June), excluding other months"
        );
    }

    /**
     * Test Case 2: Monthly Expenses Preservation
     * 
     * Verifies that monthly_expenses continues to sum from unsettled expenses
     * for the selected month/year, unchanged by the remaining_salary fix.
     * 
     * **Property 2: Preservation** - Monthly Statistics Unchanged
     * **Validates: Requirements 3.2, 3.6**
     */
    public function test_monthly_expenses_sums_unsettled_expenses_for_selected_month(): void
    {
        $user = User::factory()->create();
        
        // Add June unsettled expenses
        Expense::create([
            'user_id' => $user->id,
            'amount' => 5000,
            'date' => '2024-06-05',
            'is_settled' => false,
            'title' => 'Groceries',
            'description' => 'Monthly groceries'
        ]);
        Expense::create([
            'user_id' => $user->id,
            'amount' => 6327,
            'date' => '2024-06-12',
            'is_settled' => false,
            'title' => 'Utilities',
            'description' => 'Electric and water'
        ]);

        // Add June settled expense (should NOT be included in monthly_expenses)
        Expense::create([
            'user_id' => $user->id,
            'amount' => 2000,
            'date' => '2024-06-15',
            'is_settled' => true,
            'title' => 'Paid Bill',
            'description' => 'Already settled'
        ]);

        // Add expense from different month (should NOT be included)
        Expense::create([
            'user_id' => $user->id,
            'amount' => 88888,
            'date' => '2024-05-20',
            'is_settled' => false,
            'title' => 'May Expense',
            'description' => 'Should not be counted'
        ]);

        // Query for June 2024
        $response = $this->actingAs($user)->getJson('/api/dashboard/stats?month=6&year=2024');
        
        $response->assertStatus(200);
        
        $data = $response->json('data');
        
        // Expected: SUM of unsettled June expenses only
        $expectedMonthlyExpenses = 5000.0 + 6327.0; // = 11327
        
        // This MUST pass on unfixed code - preserves existing calculation
        $this->assertEquals(
            $expectedMonthlyExpenses, 
            $data['monthly_expenses'],
            "monthly_expenses should sum only unsettled expenses for selected month (June), excluding settled expenses and other months"
        );
    }

    /**
     * Test Case 3: Date Range Mode Preservation
     * 
     * Verifies that when using start_date and end_date parameters,
     * monthly_income and monthly_expenses are calculated for that specific range.
     * This test observes the actual behavior first, then asserts it.
     * 
     * **Property 2: Preservation** - Monthly Statistics Unchanged
     * **Validates: Requirements 3.6**
     */
    public function test_date_range_mode_calculates_stats_for_custom_range(): void
    {
        $user = User::factory()->create();
        
        // Add income across different dates
        Income::create([
            'user_id' => $user->id,
            'amount' => 1000,
            'date' => '2024-06-01',
            'source' => 'Early June',
            'description' => 'Early month - outside range'
        ]);
        Income::create([
            'user_id' => $user->id,
            'amount' => 2000,
            'date' => '2024-06-10',
            'source' => 'Start of Range',
            'description' => 'Start date - should be included'
        ]);
        Income::create([
            'user_id' => $user->id,
            'amount' => 3000,
            'date' => '2024-06-15',
            'source' => 'Mid Range',
            'description' => 'Middle of range - should be included'
        ]);
        Income::create([
            'user_id' => $user->id,
            'amount' => 4000,
            'date' => '2024-06-25',
            'source' => 'End of June',
            'description' => 'Outside range'
        ]);

        // Add expenses across different dates
        Expense::create([
            'user_id' => $user->id,
            'amount' => 500,
            'date' => '2024-06-05',
            'is_settled' => false,
            'title' => 'Early Expense',
            'description' => 'Outside range'
        ]);
        Expense::create([
            'user_id' => $user->id,
            'amount' => 1500,
            'date' => '2024-06-10',
            'is_settled' => false,
            'title' => 'Start Expense',
            'description' => 'Start date - should be included'
        ]);
        Expense::create([
            'user_id' => $user->id,
            'amount' => 2500,
            'date' => '2024-06-18',
            'is_settled' => false,
            'title' => 'Mid Expense',
            'description' => 'Middle of range - should be included'
        ]);
        Expense::create([
            'user_id' => $user->id,
            'amount' => 3500,
            'date' => '2024-06-30',
            'is_settled' => false,
            'title' => 'Late Expense',
            'description' => 'Outside range'
        ]);

        // Query for custom date range: June 10-20
        $response = $this->actingAs($user)->getJson('/api/dashboard/stats?start_date=2024-06-10&end_date=2024-06-20');
        
        $response->assertStatus(200);
        
        $data = $response->json('data');
        
        // Observation-first: We observe that whereBetween is inclusive on both ends
        // Expected: Items where date >= start_date AND date <= end_date
        // Based on actual controller behavior with whereBetween
        $expectedIncome = 2000.0 + 3000.0; // June 10 + June 15 = 5000
        $expectedExpenses = 1500.0 + 2500.0; // June 10 + June 18 = 4000
        
        // This MUST pass on unfixed code - preserves date range behavior
        $this->assertEquals(
            $expectedIncome, 
            $data['monthly_income'],
            "monthly_income should sum income within the specified date range using whereBetween (inclusive on both ends)"
        );
        
        $this->assertEquals(
            $expectedExpenses, 
            $data['monthly_expenses'],
            "monthly_expenses should sum expenses within the specified date range using whereBetween (inclusive on both ends)"
        );
    }

    /**
     * Test Case 4: Cache Behavior Preservation
     * 
     * Verifies that the cache mechanism works correctly - second identical request
     * uses cached data rather than recalculating.
     * 
     * **Property 2: Preservation** - Monthly Statistics Unchanged
     * **Validates: Requirements 3.6**
     */
    public function test_cache_behavior_remains_unchanged(): void
    {
        Cache::flush(); // Clear cache before test
        
        $user = User::factory()->create();
        
        // Create wallet with balance
        Wallet::create([
            'user_id' => $user->id,
            'balance' => 100000,
            'name' => 'Main Wallet',
            'type' => 'cash',
            'color' => '#4CAF50'
        ]);

        // Add some income and expenses
        Income::create([
            'user_id' => $user->id,
            'amount' => 5000,
            'date' => '2024-06-15',
            'source' => 'Test Income',
            'description' => 'Test'
        ]);
        
        Expense::create([
            'user_id' => $user->id,
            'amount' => 3000,
            'date' => '2024-06-15',
            'is_settled' => false,
            'title' => 'Test Expense',
            'description' => 'Test'
        ]);

        // First request - should NOT use cache
        $cacheKey = "dashboard_stats_{$user->id}_2024_6";
        $this->assertFalse(Cache::has($cacheKey), "Cache should be empty before first request");
        
        $response1 = $this->actingAs($user)->getJson('/api/dashboard/stats?month=6&year=2024');
        $response1->assertStatus(200);
        
        // Verify cache was created
        $this->assertTrue(Cache::has($cacheKey), "Cache should exist after first request");
        
        $data1 = $response1->json('data');
        
        // Second request - should use cache
        $response2 = $this->actingAs($user)->getJson('/api/dashboard/stats?month=6&year=2024');
        $response2->assertStatus(200);
        
        $data2 = $response2->json('data');
        
        // Both responses should be identical (cache working correctly)
        $this->assertEquals($data1['monthly_income'], $data2['monthly_income'], "Cached monthly_income should match");
        $this->assertEquals($data1['monthly_expenses'], $data2['monthly_expenses'], "Cached monthly_expenses should match");
        
        // Verify the cache key format is correct (includes user_id, year, month)
        $this->assertTrue(Cache::has($cacheKey), "Cache key format should be dashboard_stats_{userId}_{year}_{month}");
    }

    /**
     * Test Case 5: Unallocated Expenses Preservation
     * 
     * Verifies that unallocated_expenses calculation remains unchanged.
     * Unallocated expenses are unsettled expenses without a wallet_id.
     * 
     * **Property 2: Preservation** - Monthly Statistics Unchanged
     * **Validates: Requirements 3.6**
     */
    public function test_unallocated_expenses_calculation_unchanged(): void
    {
        $user = User::factory()->create();
        
        // Create wallet
        $wallet = Wallet::create([
            'user_id' => $user->id,
            'balance' => 50000,
            'name' => 'Main Wallet',
            'type' => 'cash',
            'color' => '#4CAF50'
        ]);

        // Add allocated expense (has wallet_id) - should NOT be in unallocated
        Expense::create([
            'user_id' => $user->id,
            'wallet_id' => $wallet->id,
            'amount' => 2000,
            'date' => '2024-06-10',
            'is_settled' => false,
            'title' => 'Allocated Expense',
            'description' => 'Has wallet'
        ]);

        // Add unallocated unsettled expenses (no wallet_id) - SHOULD be in unallocated
        Expense::create([
            'user_id' => $user->id,
            'wallet_id' => null,
            'amount' => 1000,
            'date' => '2024-06-12',
            'is_settled' => false,
            'title' => 'Unallocated Expense 1',
            'description' => 'No wallet assigned'
        ]);
        Expense::create([
            'user_id' => $user->id,
            'wallet_id' => null,
            'amount' => 1500,
            'date' => '2024-06-15',
            'is_settled' => false,
            'title' => 'Unallocated Expense 2',
            'description' => 'No wallet assigned'
        ]);

        // Add unallocated but settled expense (should NOT be in unallocated)
        Expense::create([
            'user_id' => $user->id,
            'wallet_id' => null,
            'amount' => 500,
            'date' => '2024-06-18',
            'is_settled' => true,
            'title' => 'Settled Unallocated',
            'description' => 'Settled expense'
        ]);

        // Query for June 2024
        $response = $this->actingAs($user)->getJson('/api/dashboard/stats?month=6&year=2024');
        
        $response->assertStatus(200);
        
        $data = $response->json('data');
        
        // Expected: SUM of unsettled expenses with null wallet_id
        $expectedUnallocated = 1000.0 + 1500.0; // = 2500
        
        // This MUST pass on unfixed code - preserves unallocated calculation
        $this->assertEquals(
            $expectedUnallocated, 
            $data['unallocated_expenses'],
            "unallocated_expenses should sum only unsettled expenses with null wallet_id"
        );
        
        // Verify monthly_expenses includes ALL unsettled expenses (allocated + unallocated)
        $expectedMonthlyExpenses = 2000.0 + 1000.0 + 1500.0; // = 4500
        $this->assertEquals(
            $expectedMonthlyExpenses,
            $data['monthly_expenses'],
            "monthly_expenses should include both allocated and unallocated unsettled expenses"
        );
    }
}
