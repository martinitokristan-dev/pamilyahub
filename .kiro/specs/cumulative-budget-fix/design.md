# Cumulative Budget Calculation Bugfix Design

## Overview

The bug occurs because `remaining_salary` is calculated using monthly income minus monthly expenses (`$totalIncome - $expensesTotal`), which resets to zero at the start of each month and ignores cumulative wallet balances carried forward from previous months. This causes EleFam AI to provide incorrect budget advice, warning users they're "over budget" when they actually have significant savings.

The fix changes the `remaining_salary` calculation to use the sum of all wallet balances (`SUM(wallet.balance)`), which naturally carries forward month-to-month and reflects the user's actual available funds. This is a minimal, targeted change that preserves all existing functionality while fixing the budget calculation logic.

**Key Insight:** Wallet balances are already maintained correctly by the existing expense/deposit operations. We simply need to use them for budget calculations instead of recalculating from monthly income/expenses.

## Glossary

- **Bug_Condition (C)**: The condition that triggers incorrect budget calculations - when the system calculates `remaining_salary` using monthly income/expenses instead of cumulative wallet balances
- **Property (P)**: The desired behavior - `remaining_salary` should reflect the sum of all wallet balances, accurately representing available funds across months
- **Preservation**: Existing calculations for `monthly_income`, `monthly_expenses`, and all other dashboard statistics must remain unchanged
- **`DashboardController::stats()`**: The method in `backend/app/Http/Controllers/DashboardController.php` that calculates dashboard statistics including the buggy `remaining_salary` field
- **`Wallet` Model**: Represents user financial accounts with encrypted `balance` field using the `EncryptedValue` cast
- **EleFam AI**: The AI assistant that provides budget advice based on `remaining_salary`, `monthly_income`, and `monthly_expenses` values
- **`adjustStat()` in dashboard store**: Frontend logic that adjusts statistics when expenses/income change (contains now-obsolete code for adjusting `remaining_salary`)

## Bug Details

### Bug Condition

The bug manifests when the backend calculates `remaining_salary` using monthly income and expenses that reset each month, rather than using the cumulative wallet balances that carry forward. This affects all users at all times, but is most noticeable at month boundaries and when users have significant savings.

**Formal Specification:**
```
FUNCTION isBugCondition(calculation)
  INPUT: calculation of type DashboardStatCalculation
  OUTPUT: boolean
  
  RETURN calculation.field == 'remaining_salary'
         AND calculation.method == 'monthly_income - monthly_expenses'
         AND userHasWalletBalances(calculation.userId)
         AND calculation.result != sumOfWalletBalances(calculation.userId)
END FUNCTION
```

**Location:** `backend/app/Http/Controllers/DashboardController.php`, line 68:
```php
$stats->remaining_salary = $totalIncome - $expensesTotal;  // ❌ WRONG
```

### Examples

**Example 1: Month Boundary (Most Critical)**
- **Date:** June 1st (new month, before salary deposit)
- **Wallet Balances:** ₱150,000 (carried from May)
- **June Income:** ₱0 (not deposited yet)
- **June Expenses:** ₱0
- **Current Calculation:** `remaining_salary = ₱0 - ₱0 = ₱0` ❌
- **Actual Available Funds:** ₱150,000 ✅
- **EleFam AI Says:** "Over budget! Stop spending!" (WRONG)
- **Should Say:** "₱150k left. Budget looks good!"

**Example 2: Pre-Salary Spending**
- **Date:** June 5th (before salary deposit)
- **Starting Wallet Balance:** ₱150,000
- **June Income:** ₱0
- **June Expenses:** ₱20,000 (spent from savings)
- **Current Calculation:** `remaining_salary = ₱0 - ₱20,000 = -₱20,000` ❌
- **Actual Available Funds:** ₱130,000 ✅
- **EleFam AI Says:** "Way over budget!" (WRONG)
- **Should Say:** "₱130k left. Spending is fine."

**Example 3: Normal Month with Savings (From User Evidence)**
- **Date:** June 15th (after salary deposit)
- **Wallet Balances:** ₱327,083 (cumulative)
- **June Income:** ₱13,070
- **June Expenses:** ₱11,327
- **Current Calculation:** `remaining_salary = ₱13,070 - ₱11,327 = ₱1,743` ❌
- **Actual Available Funds:** ₱327,083 ✅
- **EleFam AI Says:** "Budget almost gone. Cut non-essentials!" (WRONG - 87% of monthly income spent)
- **Should Say:** "Budget looks good!" (CORRECT - only 3.3% of actual funds spent)
- **Expenses Page Shows:** "₱327,083.00 LEFT (97% remaining)" ✅ CORRECT (uses `walletsStore.totalBalance`)

**Example 4: Edge Case - No Wallets**
- **Wallet Balances:** ₱0 (user hasn't created wallets yet)
- **Current Calculation:** `remaining_salary = monthly_income - monthly_expenses`
- **Fixed Calculation:** `remaining_salary = SUM(wallet.balance) = ₱0`
- **Result:** Both calculations produce ₱0, behavior unchanged ✅

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `monthly_income` calculation must continue to use current monthly income from `incomes` and `income_archives` tables (used by Dashboard INCOME card, Expenses page, EleFam AI daily baseline)
- `monthly_expenses` calculation must continue to use current monthly expenses from `expenses` table (used by Expenses page total/progress bar, EleFam AI spending analysis)
- `unallocated_expenses` calculation must remain unchanged
- Dashboard layout must not display `remaining_salary` directly in the UI (no UI changes needed)
- Wallet balance encryption using `EncryptedValue` cast must remain unchanged
- Cache invalidation logic must remain unchanged
- All other dashboard statistics must remain unchanged

**Scope:**
Only the calculation of `remaining_salary` should change. All inputs that don't involve the `remaining_salary` field should be completely unaffected. This includes:
- Dashboard INCOME card display (uses `monthly_income`)
- Expenses page total and progress bar (uses `monthly_expenses` and `walletsStore.totalBalance`)
- EleFam AI's analysis of monthly spending patterns (uses `monthly_income` and `monthly_expenses`)
- All other financial tracking features

**Frontend Dead Code:**
The `adjustStat()` function in `frontend/src/stores/dashboard.js` (lines 87-95) contains logic that adjusts `remaining_salary` when `monthly_expenses` or `monthly_income` changes. This logic is now obsolete because `remaining_salary` will be calculated from wallet balances, not derived from income/expenses. This code should be removed to prevent confusion, but is optional for the bug fix.

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is clear:

1. **Incorrect Calculation Method**: The `remaining_salary` field uses monthly income minus monthly expenses (`$totalIncome - $expensesTotal`) which was likely intended to show "remaining salary for this month" but is actually used by EleFam AI as "total available funds"

2. **Semantic Mismatch**: The field name `remaining_salary` suggests it should track monthly salary remaining, but EleFam AI and the Expenses page treat it as total available budget (cumulative balance)

3. **Month-Boundary Reset**: Because the calculation uses monthly values, `remaining_salary` resets to zero at the start of each month, ignoring savings carried forward from previous months

4. **Frontend Inconsistency**: The Expenses page correctly shows cumulative balance using `walletsStore.totalBalance` (which sums wallet balances), proving that wallet balances are the correct source of truth. However, EleFam AI uses the incorrect `remaining_salary` field.

**Why Wallet Balances Are Correct:**
- Wallet balances are updated by actual deposit/expense operations
- They naturally carry forward month-to-month
- They reflect the real funds available to the user
- The Expenses page already uses them successfully for "Spending Power" display

## Correctness Properties

Property 1: Bug Condition - Cumulative Balance Calculation

_For any_ dashboard stats calculation request, the `remaining_salary` field SHALL be calculated as the sum of all wallet balances for the authenticated user, accurately reflecting cumulative available funds that carry forward across months, regardless of the selected month/year parameters.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Monthly Statistics Unchanged

_For any_ dashboard stats calculation request, the `monthly_income` and `monthly_expenses` fields SHALL continue to be calculated using the current monthly income and expenses logic, preserving existing behavior for all features that depend on these monthly statistics.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

**File**: `backend/app/Http/Controllers/DashboardController.php`

**Function**: `stats(Request $request): JsonResponse`

**Specific Changes**:

1. **Add Wallet Balance Query**: After line 56 (after monthly expenses calculation), add code to calculate total wallet balance:
   ```php
   // Calculate total wallet balance (cumulative, not month-specific)
   $totalWalletBalance = (float) \App\Models\Wallet::where('user_id', $userId)
       ->get()
       ->sum(fn($w) => (float) $w->balance);
   ```

2. **Replace remaining_salary Calculation**: Change line 68 from:
   ```php
   $stats->remaining_salary = $totalIncome - $expensesTotal;  // ❌ OLD
   ```
   to:
   ```php
   $stats->remaining_salary = $totalWalletBalance;  // ✅ NEW
   ```

3. **Keep monthly_income and monthly_expenses**: Lines 66-67 remain unchanged:
   ```php
   $stats->monthly_expenses = $expensesTotal;  // ✅ Keep unchanged
   $stats->monthly_income   = $totalIncome;    // ✅ Keep unchanged
   ```

4. **No Cache Changes Needed**: The cache key already includes user_id, so wallet balance calculations will be cached per user correctly

### Optional Frontend Cleanup

**File**: `frontend/src/stores/dashboard.js`

**Function**: `adjustStat(key, delta)`

**Optional Change**: Remove obsolete logic (lines 87-95):
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

**Reasoning**: Since `remaining_salary` is now calculated from wallet balances (which are updated by the actual expense/deposit operations), this frontend adjustment logic is incorrect and should be removed. However, this is optional cleanup and not required for the bug fix to work.

### Why This Fix Is Minimal and Correct

- **Uses Existing Data**: Wallet balances are already maintained correctly by existing operations
- **No Schema Changes**: No database migrations needed
- **No API Changes**: Response structure remains identical
- **Performance**: Wallet query is fast (typically 2-5 wallets per user) and already cached
- **Encryption Preserved**: Uses existing `EncryptedValue` cast automatically
- **No Frontend Changes Required**: EleFam AI will automatically use correct value once backend is fixed

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code using the user's actual scenario, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the root cause analysis using real-world data.

**Test Plan**: Write tests that call the dashboard stats endpoint with various scenarios and compare `remaining_salary` with the actual sum of wallet balances. Run these tests on the UNFIXED code to observe the incorrect calculations.

**Test Cases**:
1. **Month Boundary Test**: Set date to June 1st, create wallets with ₱150,000 balance, verify June income = ₱0, June expenses = ₱0 (will show `remaining_salary = ₱0` on unfixed code instead of ₱150,000)
2. **Pre-Salary Spending Test**: Set date to June 5th, start with ₱150,000 in wallets, add ₱20,000 in June expenses, no June income (will show `remaining_salary = -₱20,000` on unfixed code instead of ₱130,000)
3. **User Evidence Test**: Replicate exact scenario from user screenshot - ₱327,083 in wallets, ₱13,070 June income, ₱11,327 June expenses (will show `remaining_salary = ₱1,743` on unfixed code instead of ₱327,083)
4. **No Wallets Test**: User with no wallets created yet (should show ₱0 before and after fix)

**Expected Counterexamples**:
- `remaining_salary` field returns monthly income minus monthly expenses
- Value does not match sum of wallet balances
- Root cause confirmed: calculation uses `$totalIncome - $expensesTotal` instead of wallet balances

### Fix Checking

**Goal**: Verify that after the fix, `remaining_salary` always equals the sum of wallet balances for all test scenarios.

**Pseudocode:**
```
FOR ALL test_scenario IN [month_boundary, pre_salary_spending, user_evidence, no_wallets] DO
  setup_scenario(test_scenario)
  result := getDashboardStats_fixed()
  expected := sumOfWalletBalances()
  ASSERT result.remaining_salary == expected
END FOR
```

**Implementation Approach**: 
- Create PHP unit tests using Laravel's testing framework
- Use test database with seeded users, wallets, expenses, and income
- Query both the stats endpoint and calculate expected wallet sum
- Assert equality within floating-point tolerance (0.01)

### Preservation Checking

**Goal**: Verify that all other dashboard statistics remain unchanged after the fix, particularly `monthly_income` and `monthly_expenses` which are critical for other features.

**Pseudocode:**
```
FOR ALL test_scenario IN [various_dates, various_amounts, various_wallets] DO
  result_original := getDashboardStats_unfixed()
  result_fixed := getDashboardStats_fixed()
  
  ASSERT result_fixed.monthly_income == result_original.monthly_income
  ASSERT result_fixed.monthly_expenses == result_original.monthly_expenses
  ASSERT result_fixed.unallocated_expenses == result_original.unallocated_expenses
  // Only remaining_salary should differ
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically with random dates, amounts, and wallet counts
- It catches edge cases like leap years, month boundaries, decimal precision
- It provides strong guarantees that monthly statistics are unchanged across all scenarios

**Test Plan**: Capture the current behavior for `monthly_income` and `monthly_expenses` calculations, then verify they remain identical after the fix across many generated scenarios.

**Test Cases**:
1. **Monthly Income Preservation**: Verify `monthly_income` continues to sum from `incomes` and `income_archives` tables for the selected month/year
2. **Monthly Expenses Preservation**: Verify `monthly_expenses` continues to sum unsettled expenses for the selected month/year
3. **Cache Behavior Preservation**: Verify cache keys and TTL (120 seconds) remain unchanged
4. **Date Range Preservation**: Verify both month/year and start_date/end_date query modes work correctly
5. **EleFam AI Integration**: Test that EleFam AI receives correct `remaining_salary` and continues to work with `monthly_income` and `monthly_expenses`

### Unit Tests

- Test wallet balance summation with 0, 1, 3, 10 wallets
- Test with encrypted balance values to ensure EncryptedValue cast works correctly
- Test `remaining_salary` calculation at month boundaries (last day of month, first day of month)
- Test with negative wallet balances (edge case)
- Test with very large wallet balances (billions, test precision)
- Test cache behavior - verify stats are cached and invalidated correctly
- Test with different month/year parameters to ensure wallet sum is always used (not month-specific)

### Property-Based Tests

- Generate random user scenarios with random wallet counts (0-20) and random balances (-10000 to 1000000)
- Generate random dates (2020-2025) and verify `remaining_salary` always equals wallet sum
- Generate random expense/income amounts and verify `monthly_income` and `monthly_expenses` preservation
- Test that for any month, `remaining_salary` is independent of the month parameter (always current wallet sum)
- Test floating-point precision with random decimal values

### Integration Tests

- Test full user flow: create account → create wallets → add salary deposit → add expenses → check dashboard stats
- Test EleFam AI receives correct values: simulate chat request and verify bubble line uses correct `remaining_salary`
- Test Expenses page continues to show correct "Spending Power" using `walletsStore.totalBalance`
- Test month-to-month transition: verify `remaining_salary` carries forward as wallet balances update
- Test with real user data (anonymized): replicate the exact scenario from the user's screenshot

### Manual Testing Checklist

After deploying the fix:

1. **Verify User Evidence Scenario Fixed**:
   - Check that with ₱327k in wallets, ₱13k income, ₱11k expenses
   - EleFam AI says "Budget looks good!" not "budget almost gone"
   - Ratio should be 11,327 / 327,083 = 3.3% not 87%

2. **Verify Month Boundary**:
   - Set date to first day of new month (before salary deposit)
   - Verify EleFam AI doesn't warn "over budget" if wallets have funds

3. **Verify Expenses Page Unchanged**:
   - Verify "Spending Power" still shows correct total balance
   - Verify monthly expenses total and progress bar work correctly

4. **Verify Dashboard Cards Unchanged**:
   - Verify INCOME card shows monthly income (not affected by fix)
   - Verify other cards (debts, upcoming payments) work correctly
