# Implementation Plan

## Overview

This implementation plan follows the exploratory bugfix workflow using the bug condition methodology. The tasks are ordered to explore and understand the bug first, preserve existing behavior, then implement the fix with validation.

**Bug Summary**: `remaining_salary` uses monthly calculation (`totalIncome - expensesTotal`) instead of cumulative wallet balance, causing EleFam AI to give wrong advice (e.g., "budget almost gone" when user has ₱327k available).

**Fix Summary**: Change backend to calculate `remaining_salary` from sum of wallet balances.

---

## Task Dependency Graph

```json
{
  "waves": [
    {
      "name": "Wave 1: Exploration & Preservation Testing",
      "tasks": [1, 2],
      "description": "Write tests on unfixed code to understand the bug and capture baseline behavior"
    },
    {
      "name": "Wave 2: Fix Implementation",
      "tasks": [3],
      "description": "Implement the fix and verify with existing tests"
    },
    {
      "name": "Wave 3: Cleanup & Verification",
      "tasks": [4, 5, 6],
      "description": "Optional cleanup, manual testing, and final checkpoint"
    }
  ]
}
```

**Visual Dependency Flow:**
```
1. Write bug condition exploration test (standalone)
   ↓
2. Write preservation property tests (standalone)
   ↓
3. Fix remaining_salary calculation
   ├─ 3.1 Implement the fix in backend
   ├─ 3.2 Verify bug condition exploration test now passes (depends on 3.1, 1)
   └─ 3.3 Verify preservation tests still pass (depends on 3.1, 2)
   ↓
4. (Optional) Clean up obsolete frontend logic (depends on 3.1)
   ↓
5. Manual verification with user's exact scenario (depends on 3)
   ↓
6. Checkpoint - Ensure all tests pass (depends on all)
```

**Key Dependencies:**
- Tasks 1 and 2 are independent and can be done in parallel
- Task 3.1 must be completed before 3.2 and 3.3
- Tasks 3.2 and 3.3 depend on tests from tasks 1 and 2 respectively
- Task 4 is optional and can be done independently after 3.1
- Task 5 requires task 3 to be complete
- Task 6 is the final checkpoint

---

## Notes

### Bug Condition Methodology

This bugfix follows the bug condition methodology:
- **C(X)**: Bug Condition - `calculation.field == 'remaining_salary' AND calculation.method == 'monthly_income - monthly_expenses'`
- **P(result)**: Property - `remaining_salary` should equal `SUM(wallet.balance)` for the user
- **¬C(X)**: Non-buggy calculations - `monthly_income`, `monthly_expenses`, and all other dashboard stats should be preserved

### Testing Strategy

1. **Exploration Test (Task 1)**: Write tests that FAIL on unfixed code, demonstrating the bug with concrete counterexamples from user evidence
2. **Preservation Test (Task 2)**: Write tests that PASS on unfixed code, capturing baseline behavior to preserve
3. **Fix Validation (Task 3.2)**: Re-run exploration test - should now PASS, confirming bug is fixed
4. **Regression Check (Task 3.3)**: Re-run preservation test - should still PASS, confirming no regressions

### Implementation Notes

- **Minimal Change**: Only one line changes in `DashboardController.php` (line 68)
- **No Schema Changes**: Uses existing wallet table with encrypted balances
- **No API Changes**: Response structure remains identical
- **No Frontend Changes Required**: EleFam AI automatically uses corrected value
- **Optional Cleanup**: Frontend `adjustStat()` logic is now obsolete but can be removed separately

### File Locations

- **Backend Controller**: `backend/app/Http/Controllers/DashboardController.php` (line 68)
- **Bug Condition Test**: `backend/tests/Feature/DashboardStatsRemainingBudgetTest.php` (new file)
- **Preservation Test**: `backend/tests/Feature/DashboardStatsPreservationTest.php` (new file)
- **Optional Frontend Cleanup**: `frontend/src/stores/dashboard.js` (lines 87-95)

---

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Cumulative Balance vs Monthly Calculation
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Test concrete failing scenarios from user evidence
  - Create Laravel feature test in `backend/tests/Feature/DashboardStatsRemainingBudgetTest.php`
  - Test the dashboard stats endpoint `/api/dashboard/stats`
  - **Test Case 1 - Month Boundary**: User with ₱150,000 in wallets, June 1st, ₱0 June income, ₱0 June expenses → assert `remaining_salary` should be ₱150,000 (will fail with ₱0 on unfixed code)
  - **Test Case 2 - Pre-Salary Spending**: User with ₱150,000 starting balance, June 5th, ₱0 June income, ₱20,000 June expenses → assert `remaining_salary` should be ₱130,000 (will fail with -₱20,000 on unfixed code)
  - **Test Case 3 - User Evidence**: User with ₱327,083 in wallets, ₱13,070 June income, ₱11,327 June expenses → assert `remaining_salary` should be ₱327,083 (will fail with ₱1,743 on unfixed code)
  - **Test Case 4 - No Wallets**: User with no wallets → assert `remaining_salary` should be ₱0 (passes both before and after fix)
  - Each test case should calculate expected value as: `SUM(wallet.balance)` for the user
  - Each test case should compare with actual `remaining_salary` returned by the API
  - Run test on UNFIXED code using `php artisan test --filter=DashboardStatsRemainingBudgetTest`
  - **EXPECTED OUTCOME**: Test FAILS for cases 1, 2, 3 (this is correct - it proves the bug exists)
  - Document counterexamples found:
    - Month boundary: Returns ₱0 instead of ₱150,000
    - Pre-salary spending: Returns -₱20,000 instead of ₱130,000
    - User evidence: Returns ₱1,743 instead of ₱327,083
  - Mark task complete when test is written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Monthly Statistics Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Create Laravel feature test in `backend/tests/Feature/DashboardStatsPreservationTest.php`
  - **Observe behavior on UNFIXED code**: Run dashboard stats endpoint with various scenarios and record `monthly_income` and `monthly_expenses` values
  - **Test Case 1 - Monthly Income Preservation**: For June with ₱13,070 income from `incomes` table → observe and assert `monthly_income = ₱13,070`
  - **Test Case 2 - Monthly Expenses Preservation**: For June with ₱11,327 expenses from `expenses` table → observe and assert `monthly_expenses = ₱11,327`
  - **Test Case 3 - Date Range Mode**: Test with `start_date` and `end_date` parameters → observe and assert `monthly_income` and `monthly_expenses` are calculated for that range
  - **Test Case 4 - Cache Behavior**: Make two identical requests → observe second request uses cache (verify with Laravel's Cache facade)
  - **Test Case 5 - Other Stats**: Verify `unallocated_expenses` calculation remains unchanged
  - Write property-based tests that assert these observed behaviors across random scenarios:
    - Generate random dates (2020-2025)
    - Generate random income amounts (₱0 to ₱100,000)
    - Generate random expense amounts (₱0 to ₱100,000)
    - Assert `monthly_income` always sums from `incomes` + `income_archives` for selected month
    - Assert `monthly_expenses` always sums from `expenses` for selected month
  - Property-based testing provides stronger guarantees that behavior is unchanged
  - Use a PBT library like `Pest` with property testing or write custom test data generators
  - Run tests on UNFIXED code using `php artisan test --filter=DashboardStatsPreservationTest`
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix remaining_salary calculation in DashboardController

  - [x] 3.1 Implement the fix in backend
    - Open `backend/app/Http/Controllers/DashboardController.php`
    - Locate the `stats()` method (around line 30-90)
    - After line 56 (after `$expensesTotal` calculation), add wallet balance query:
      ```php
      // Calculate total wallet balance (cumulative, not month-specific)
      $totalWalletBalance = (float) \App\Models\Wallet::where('user_id', $userId)
          ->get()
          ->sum(fn($w) => (float) $w->balance);
      ```
    - Find line 68 where `remaining_salary` is set: `$stats->remaining_salary = $totalIncome - $expensesTotal;`
    - Replace it with: `$stats->remaining_salary = $totalWalletBalance;`
    - Ensure lines 66-67 remain unchanged:
      - `$stats->monthly_expenses = $expensesTotal;` (unchanged)
      - `$stats->monthly_income = $totalIncome;` (unchanged)
    - No cache changes needed (cache key already includes user_id)
    - _Bug_Condition: `isBugCondition(calculation)` where `calculation.field == 'remaining_salary' AND calculation.method == 'monthly_income - monthly_expenses'`_
    - _Expected_Behavior: `remaining_salary` SHALL be calculated as `SUM(wallet.balance)` for the authenticated user, carrying forward month-to-month_
    - _Preservation: Monthly income/expenses calculations, cache behavior, wallet encryption, all other dashboard stats remain unchanged_
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Cumulative Balance Calculation
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run: `php artisan test --filter=DashboardStatsRemainingBudgetTest`
    - **EXPECTED OUTCOME**: All 4 test cases now PASS
      - Month boundary: Returns ₱150,000 ✓
      - Pre-salary spending: Returns ₱130,000 ✓
      - User evidence: Returns ₱327,083 ✓
      - No wallets: Returns ₱0 ✓
    - Verify `remaining_salary` now equals sum of wallet balances for all scenarios
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Monthly Statistics Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run: `php artisan test --filter=DashboardStatsPreservationTest`
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions)
    - Verify `monthly_income` still sums from `incomes` + `income_archives` for selected month
    - Verify `monthly_expenses` still sums from `expenses` for selected month
    - Verify cache behavior unchanged (120 second TTL, user_id in key)
    - Verify all other statistics unchanged (`unallocated_expenses`, etc.)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. (Optional) Clean up obsolete frontend logic
  - Open `frontend/src/stores/dashboard.js`
  - Locate the `adjustStat()` function (around lines 87-95)
  - Remove the obsolete logic that adjusts `remaining_salary` based on `monthly_expenses` and `monthly_income`:
    ```javascript
    // REMOVE THESE LINES (now obsolete):
    if (key === "monthly_expenses") {
      stats.value.remaining_salary =
        parseFloat(stats.value.remaining_salary ?? 0) - delta;
    }
    if (key === "monthly_income") {
      stats.value.remaining_salary =
        parseFloat(stats.value.remaining_salary ?? 0) + delta;
    }
    ```
  - **Reasoning**: Since `remaining_salary` is now calculated from wallet balances (which are updated by actual expense/deposit operations), this frontend adjustment is incorrect and misleading
  - This is optional cleanup and not required for the bug fix to work
  - No tests needed for this cleanup (behavior should be unchanged since backend now returns correct value)

- [x] 5. Manual verification with user's exact scenario
  - Set up test environment with user's exact data:
    - Create wallets totaling ₱327,083
    - Add June income of ₱13,070
    - Add June expenses of ₱11,327
  - Test dashboard stats API:
    - GET `/api/dashboard/stats?month=6&year=2024`
    - Verify response: `remaining_salary: 327083` ✓
    - Verify response: `monthly_income: 13070` ✓
    - Verify response: `monthly_expenses: 11327` ✓
  - Test EleFam AI integration:
    - Open chat with EleFam AI
    - Ask "How's my budget?"
    - Verify AI says something like "Budget looks good!" (not "budget almost gone")
    - Verify AI calculates spending ratio as 11,327 / 327,083 = 3.3% (not 87%)
  - Test Expenses page:
    - Navigate to Expenses page
    - Verify "Spending Power" shows ₱327,083.00 LEFT (97% remaining)
    - Verify monthly expenses total shows ₱11,327
    - Verify progress bar reflects correct cumulative balance
  - Test month boundary scenario:
    - Change system date to July 1st (or add test data for July)
    - Before adding any July salary deposits
    - Verify dashboard shows `remaining_salary` = ₱327,083 (carried forward)
    - Verify EleFam AI doesn't say "over budget"

- [x] 6. Checkpoint - Ensure all tests pass
  - Run full backend test suite: `php artisan test`
  - Ensure all existing tests still pass (no regressions)
  - Ensure new bug condition test passes (confirms fix works)
  - Ensure new preservation tests pass (confirms no breaking changes)
  - If any tests fail, investigate and fix before marking complete
  - Ask user if questions arise or if manual testing reveals issues

