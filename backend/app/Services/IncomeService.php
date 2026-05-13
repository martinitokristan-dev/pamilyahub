<?php

namespace App\Services;

use App\Repositories\IncomeRepository;
use App\Repositories\WalletRepository;
use Illuminate\Support\Facades\DB;

class IncomeService
{
    public function __construct(
        private IncomeRepository $incomeRepository,
        private WalletRepository $walletRepository
    ) {}

    public function depositSalary(int $userId, array $deposits): void
    {
        DB::transaction(function () use ($userId, $deposits) {
            foreach ($deposits as $deposit) {
                $this->incomeRepository->create([
                    'user_id' => $userId,
                    'wallet_id' => $deposit['wallet_id'],
                    'amount' => $deposit['amount'],
                    'source' => 'Salary',
                    'date' => now()->toDateString(),
                    'description' => 'Monthly Salary Deposit'
                ]);

                $this->walletRepository->adjustBalance($deposit['wallet_id'], (float)$deposit['amount']);
            }
            \App\Http\Controllers\DashboardController::invalidateCache($userId);
        });
    }
}
