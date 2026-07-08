# Bugfix Requirements Document

## Introduction

The `remaining_salary` field in the dashboard statistics incorrectly resets to zero at the start of each month, causing EleFam AI to provide inaccurate budget advice. This bug occurs because the backend calculates `remaining_salary` using monthly income and expenses (`totalIncome - expensesTotal`) rather than the cumulative wallet balance. As a result, users with significant savings carried forward from previous months receive warnings like "over budget" when they actually have substantial funds available.

The impact is particularly problematic at the beginning of a new month before salary deposits, where users may have ₱150,000 in actual wallet balances but the system reports ₱0 remaining salary, leading to completely incorrect financial guidance from EleFam AI.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user has wallet balances totaling ₱150,000 at the end of May and advances to June 1st (before any deposits) THEN the system calculates `remaining_salary = ₱0 (June income) - ₱0 (June expenses) = ₱0` instead of reflecting the actual ₱150,000 available

1.2 WHEN a user spends ₱20,000 on June 5th before receiving their salary deposit THEN the system calculates `remaining_salary = ₱0 - ₱20,000 = -₱20,000` (negative) instead of reflecting the actual remaining balance of ₱130,000

1.3 WHEN EleFam AI evaluates budget status using the incorrect `remaining_salary` value THEN the system provides incorrect advice such as "Over budget! Stop spending!" when the user actually has significant available funds

1.4 WHEN the backend DashboardController calculates statistics THEN the system uses monthly income and expenses (`$totalIncome - $expensesTotal`) which resets every month and does not account for cumulative wallet balances

### Expected Behavior (Correct)

2.1 WHEN a user has wallet balances totaling ₱150,000 at the end of May and advances to June 1st (before any deposits) THEN the system SHALL calculate `remaining_salary` as the sum of all wallet balances (₱150,000), accurately reflecting available funds

2.2 WHEN a user spends ₱20,000 on June 5th before receiving their salary deposit THEN the system SHALL calculate `remaining_salary` as the sum of all current wallet balances (₱130,000), correctly showing remaining available funds

2.3 WHEN EleFam AI evaluates budget status using the corrected `remaining_salary` value THEN the system SHALL provide accurate advice based on actual cumulative wallet balances, such as "₱150k left. Budget looks good!" when appropriate

2.4 WHEN the backend DashboardController calculates statistics THEN the system SHALL calculate `remaining_salary` as the sum of all wallet balances for the authenticated user, carrying forward month-to-month and reflecting real available funds

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the system calculates `monthly_income` for the Dashboard "INCOME" card, Expenses page, and EleFam AI THEN the system SHALL CONTINUE TO use the current monthly income calculation without modification

3.2 WHEN the system calculates `monthly_expenses` for the Expenses page total, progress bar, and EleFam AI THEN the system SHALL CONTINUE TO use the current monthly expenses calculation without modification

3.3 WHEN the Expenses page displays "Spending Power" THEN the system SHALL CONTINUE TO use `walletsStore.totalBalance` (which is already correct)

3.4 WHEN the Dashboard layout renders THEN the system SHALL CONTINUE TO not display the Budget Left value directly in the UI (no UI changes required)

3.5 WHEN wallet balances are stored or retrieved THEN the system SHALL CONTINUE TO use the `EncryptedValue` cast for encryption

3.6 WHEN the system fetches expenses and income for the selected month THEN the system SHALL CONTINUE TO use the current query logic for these values
