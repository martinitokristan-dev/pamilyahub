<?php

namespace App\Services;

use App\Repositories\IncomeRepository;
use App\Repositories\WalletRepository;
use App\Services\UserStatsService;
use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\DB;

class IncomeService
{
    public function __construct(
        private IncomeRepository $incomeRepository,
        private WalletRepository $walletRepository,
        private UserStatsService $statsService,
    ) {}

    public function create(int $userId, array $data): void
    {
        DB::transaction(function () use ($userId, $data) {
            $data['user_id'] = $userId;
            $this->incomeRepository->create($data);
            
            if (!empty($data['wallet_id'])) {
                $this->walletRepository->adjustBalance($data['wallet_id'], (float)$data['amount']);
            }

            $this->statsService->adjust($userId, 'income_total', +(float)$data['amount']);
            DashboardController::invalidateCache($userId);
        });
    }

    public function update(int $userId, int $id, array $data): void
    {
        DB::transaction(function () use ($userId, $id, $data) {
            $income = $this->incomeRepository->findById($id);
            if (!$income || $income->user_id !== $userId) return;

            $oldAmount = (float)$income->amount;
            $newAmount = (float)($data['amount'] ?? $oldAmount);

            $this->incomeRepository->update($income, $data);
            
            $delta = $newAmount - $oldAmount;
            if ($delta !== 0.0) {
                $this->statsService->adjust($userId, 'income_total', $delta);
            }

            DashboardController::invalidateCache($userId);
        });
    }

    public function delete(int $userId, int $id): void
    {
        DB::transaction(function () use ($userId, $id) {
            $income = $this->incomeRepository->findById($id);
            if (!$income || $income->user_id !== $userId) return;

            $amount = (float)$income->amount;
            $this->incomeRepository->delete($income);
            
            $this->statsService->adjust($userId, 'income_total', -$amount);
            DashboardController::invalidateCache($userId);
        });
    }

    public function depositSalary(int $userId, array $deposits): void
    {
        DB::transaction(function () use ($userId, $deposits) {
            $total = 0;
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
                $total += (float)$deposit['amount'];
            }
            
            $this->statsService->adjust($userId, 'income_total', $total);
            DashboardController::invalidateCache($userId);
        });
    }
}
