# Cumulative Budget Logic Implementation Plan

## 🎯 Goal
Fix "Budget Left" to carry forward month-to-month instead of resetting. Users should see their real available money, not just current month's calculation.

## 📊 Current Problem

**May:**
- Income: ₱200,000
- Spent: ₱50,000
- Budget Left: ₱150,000 ✅

**June 1st (Before salary deposit):**
- Budget Left: ₱0 ❌ WRONG! (Should be ₱150,000 from May)

## ✅ Correct Logic

### What RESETS every month:
- **"This Month Spent"** → Resets to ₱0 on the 1st of each month

### What CONTINUES (never resets):
- **"Budget Left"** → Carries forward forever (cumulative)

## 📈 Example Timeline

```
MAY:
  Previous Balance:  ₱0
  + Income:          ₱200,000
  - Spent:           ₱50,000
  = Budget Left:     ₱150,000  ← carries forward

JUNE 1st:
  Previous Balance:  ₱150,000  ← from May ✅
  This Month Spent:  ₱0        ← reset ✅

JUNE 15th (after deposit):
  Previous Balance:  ₱150,000
  + Income:          ₱200,000
  - Spent so far:    ₱20,000
  = Budget Left:     ₱330,000
  This Month Spent:  ₱20,000   ← June only

JUNE 30th:
  Budget Left:       ₱270,000  ← cumulative
  This Month Spent:  ₱80,000   ← June total

JULY 1st:
  Budget Left:       ₱270,000  ← carried forward ✅
  This Month Spent:  ₱0        ← reset ✅
```

## 🔧 Implementation Changes

### Backend: `app/Http/Controllers/DashboardController.php`

**Current (WRONG):**
```php
$stats->remaining_salary = $monthlyIncome - $monthlyExpenses;
```

**New (CORRECT):**
```php
// Budget Left = Total wallet balance (cumulative)
$stats->remaining_salary = $totalWalletBalance;

// This keeps monthly_expenses for "This Month" display
$stats->monthly_expenses = $currentMonthExpenses; // This already exists
```

### Frontend Changes (Minimal)

**Files affected:**
- `frontend/src/views/Dashboard.vue` - Already displays budget_left correctly
- `frontend/src/views/Expenses.vue` - Already uses monthly filtering correctly
- No new cards needed!

## 📝 Formula

```
Budget Left (Cumulative):
  = SUM(All time deposits) - SUM(All time expenses)
  = Current wallet balance
  = Never resets

This Month Spent (Monthly):
  = SUM(Current month expenses only)
  = Resets to ₱0 on the 1st of each month
```

## ✅ Dashboard Display (No Changes Needed)

```
┌─────────────────────────────────────┐
│ 💰 Budget Left                      │
│    ₱390,000  ← Fix this calculation │
│                                     │
│ 📊 This Month                       │
│    Income: ₱200,000                 │
│    Spent: ₱80,000  ← Already correct│
└─────────────────────────────────────┘
```

## 🎯 Key Points

1. **NO new cards needed** - just fix the calculation
2. **"Budget Left"** = Real money in wallets (cumulative)
3. **"This Month Spent"** = Current month only (resets)
4. **Expenses page filtering** = Already works correctly
5. **Backend change** = Mainly in DashboardController.php

## 📁 Files to Modify

**Backend:**
- `backend/app/Http/Controllers/DashboardController.php` (main change)

**Frontend (verify/test only):**
- `frontend/src/views/Dashboard.vue`
- `frontend/src/stores/dashboard.js`
- `frontend/src/views/Expenses.vue`

## 🧪 Test Scenarios

1. **End of May:** Budget Left = ₱150,000
2. **June 1st (before deposit):** Budget Left should still be ₱150,000
3. **June 15th (after deposit):** Budget Left = ₱150,000 + ₱200,000 = ₱350,000
4. **Filter expenses by June:** Should only show June expenses
5. **"This Month Spent":** Should reset to ₱0 on July 1st
6. **"Budget Left":** Should NEVER reset, only grow/shrink with deposits/expenses

## 📋 Commit Message

```
feat: implement cumulative budget logic

BREAKING CHANGE: Budget Left now carries forward month-to-month

- Budget Left now shows total available funds (cumulative)
- "This Month Spent" still resets monthly for tracking
- Users can see their real savings grow over time
- Fixes confusing "disappeared money" issue

Backend:
- Update DashboardController to use wallet balance for Budget Left
- Keep monthly_expenses for "This Month" display

Frontend:
- No UI changes needed (same cards)
- Budget Left now reflects real available money

Closes #XXX
```

## 🚀 Ready to Implement

Start with:
1. Read `backend/app/Http/Controllers/DashboardController.php`
2. Find the `remaining_salary` calculation
3. Change it to use cumulative wallet balance
4. Test with the scenarios above

---

**Created:** Based on conversation about budget carryover logic  
**Status:** Ready for implementation  
**Impact:** High (fixes major user confusion)
