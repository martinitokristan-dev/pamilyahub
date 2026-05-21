<?php

namespace App\Services;

use App\Repositories\SalaryDepositRepository;
use App\Repositories\IncomeRepository;
use App\Repositories\WalletRepository;
use App\Services\ExpenseService;
use App\Services\UserStatsService;
use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\DB;

class SalaryDepositService
{
    public function __construct(
        private SalaryDepositRepository $depositRepo,
        private IncomeRepository        $incomeRepo,
        private WalletRepository        $walletRepo,
        private ExpenseService          $expenseService,
        private UserStatsService        $statsService,
    ) {}

    /**
     * Get current-month salary status for a user.
     * Returns: status ('pending'|'received'), deposit record(s) if any.
     */
    public function getCurrentMonthStatus(int $userId): array
    {
        $now    = now();
        $month  = $now->month;
        $year   = $now->year;
        $today  = $now->day;

        $deposits = $this->depositRepo->getForMonth($userId, $month, $year);

        if ($deposits->isEmpty()) {
            return [
                'status'     => 'pending',
                'month'      => $month,
                'year'       => $year,
                'is_delayed' => $today > 5,   // past 5th = show reminder
                'deposits'   => [],
            ];
        }

        return [
            'status'   => 'received',
            'month'    => $month,
            'year'     => $year,
            'deposits' => $deposits,
        ];
    }

    /**
     * Deposit salary:
     *  1. Create a salary_deposit record
     *  2. Create income rows per wallet (for dashboard stats)
     *  3. Adjust each wallet balance atomically
     *  4. Invalidate dashboard cache
     */
    public function deposit(
        int    $userId,
        float  $totalAmount,
        float  $alreadySpent,
        array  $walletAllocations,
        ?string $notes = null
    ): void {
        DB::transaction(function () use ($userId, $totalAmount, $alreadySpent, $walletAllocations, $notes) {
            $now       = now();
            $isDelayed = $now->day > 10;

            // 1. Create salary_deposit record
            $this->depositRepo->create([
                'user_id'       => $userId,
                'amount'        => $totalAmount,
                'already_spent' => $alreadySpent,
                'month'         => $now->month,
                'year'          => $now->year,
                'deposited_at'  => $now,
                'is_delayed'    => $isDelayed,
                'notes'         => $notes,
            ]);

            // 2. Create income rows per wallet and adjust balances
            foreach ($walletAllocations as $alloc) {
                $this->incomeRepo->create([
                    'user_id'     => $userId,
                    'wallet_id'   => $alloc['wallet_id'],
                    'amount'      => $alloc['amount'],
                    'source'      => 'Salary',
                    'date'        => $now->toDateString(),
                    'description' => 'Monthly Salary Deposit',
                ]);

                $this->walletRepo->adjustBalance($alloc['wallet_id'], (float) $alloc['amount']);
            }

            // 2.5 Create Expense for Already Spent
            if ($alreadySpent > 0) {
                $this->expenseService->create($userId, [
                    'title'       => 'Already Spent',
                    'amount'      => $alreadySpent,
                    'category'    => 'Already Spent',
                    'description' => 'Pre-existing spending logged during salary deposit',
                    'date'        => $now->toDateString(),
                    'wallet_id'   => null,
                ]);
            }

            // 2.6 Invalidate dashboard cache (stats calculated from tables, not incremental)
            DashboardController::invalidateCache($userId);
        });
    }

    public function update(int $userId, int $id, array $data): void
    {
        DB::transaction(function () use ($userId, $id, $data) {
            $deposit = $this->depositRepo->findById($id);
            if (!$deposit || $deposit->user_id !== $userId) return;

            $this->depositRepo->update($deposit, $data);
            DashboardController::invalidateCache($userId);
        });
    }

    public function delete(int $userId, int $id): void
    {
        DB::transaction(function () use ($userId, $id) {
            $deposit = $this->depositRepo->findById($id);
            if (!$deposit || $deposit->user_id !== $userId) return;

            $this->depositRepo->delete($deposit);
            DashboardController::invalidateCache($userId);
        });
    }
}
