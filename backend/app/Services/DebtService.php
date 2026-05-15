<?php

namespace App\Services;

use App\Models\Debt;
use App\Repositories\DebtRepository;
use App\Repositories\WalletRepository;
use App\Repositories\ExpenseRepository;
use App\Services\UserStatsService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class DebtService
{
    public function __construct(
        private DebtRepository    $repository,
        private WalletRepository  $walletRepository,
        private UserStatsService  $stats,
        private ExpenseRepository $expenseRepository,
    ) {}

    public function getAll(int $userId): Collection
    {
        return $this->repository->getByUser($userId);
    }

    public function getAllPaginated(int $userId, int $perPage = 20, int $page = 1, ?string $type = null, ?string $search = null): array
    {
        return $this->repository->getByUserPaginated($userId, $perPage, $page, $type, $search);
    }

    public function create(int $userId, array $data): Debt
    {
        return DB::transaction(function () use ($userId, $data) {
            $data['user_id'] = $userId;
            // 1. Create debt record
            $debt = $this->repository->create($data);
            
            // 2. Handle Financial Side Effects
            if ($data['type'] === 'owed_to_me') {
                // Lend money: Deduct from wallet and log as expense
                if (!empty($data['wallet_id'])) {
                    $this->walletRepository->adjustBalance($data['wallet_id'], -(float)$data['amount']);
                }

                $this->expenseRepository->create([
                    'user_id'     => $userId,
                    'title'       => "Lent money to: " . $data['name'],
                    'amount'      => $data['amount'],
                    'category'    => 'Bills/Debt',
                    'date'        => now()->toDateString(),
                    'wallet_id'   => $data['wallet_id'] ?? null,
                    'description' => $data['description'] ?? 'Lending money'
                ]);

                $this->stats->adjust($userId, 'expenses_total', (float) $data['amount']);
                $this->stats->adjust($userId, 'debts_owed_to_me', (float) $data['amount']);
            } else {
                // I Owe: Just a record, no wallet movement or income logging upon creation.
                // It will be logged as an expense and deducted from wallet only when PAID.
                $this->stats->adjust($userId, 'debts_i_owe', (float) $data['amount']);
            }

            \App\Http\Controllers\DashboardController::invalidateCache($userId);
            return $debt;
        });
    }

    public function update(int $userId, int $id, array $data): ?Debt
    {
        $debt = $this->repository->findByUser($id, $userId);
        if (! $debt) return null;

        $amountChanged = isset($data['amount']) && (float)$data['amount'] !== (float)$debt->amount;
        $typeChanged = isset($data['type']) && $data['type'] !== $debt->type;

        $result = $this->repository->update($debt, $data);

        if ($amountChanged || $typeChanged) {
            $this->stats->recalculate($userId);
        }
        \App\Http\Controllers\DashboardController::invalidateCache($userId);
        return $result;
    }

    public function markPaid(int $userId, int $id, ?int $walletId = null): ?Debt
    {
        $debt = $this->repository->findByUser($id, $userId);
        if (! $debt) return null;

        return DB::transaction(function () use ($userId, $debt, $walletId) {
            $amount = (float) $debt->amount;

            if ($walletId) {
                // i_owe → deduct; owed_to_me → receive (add)
                $delta = $debt->type === 'i_owe' ? -$amount : $amount;
                $this->walletRepository->adjustBalance($walletId, $delta);
            }
            $result = $this->repository->update($debt, ['is_paid' => true]);
            
            // If it's a debt I OWE, log it as an expense
            if ($debt->type === 'i_owe') {
                $this->expenseRepository->create([
                    'user_id' => $userId,
                    'title' => "Debt Payment: " . $debt->name,
                    'amount' => $amount,
                    'category' => 'Bills/Debt',
                    'date' => now()->toDateString(),
                    'wallet_id' => $walletId,
                    'description' => $debt->description ?? 'Paid off debt'
                ]);
                $this->stats->adjust($userId, 'expenses_total', $amount);
            } else {
                // If it's a debt OWED TO ME, log it as a general Income (NOT Salary)
                DB::table('incomes')->insert([
                    'user_id'     => $userId,
                    'wallet_id'   => $walletId,
                    'amount'      => $amount,
                    'source'      => 'Debt Collection',
                    'date'        => now()->toDateString(),
                    'description' => "Debt Payment from: " . $debt->name,
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            }

            // Subtract from the appropriate debt field
            $field = $debt->type === 'i_owe' ? 'debts_i_owe' : 'debts_owed_to_me';
            $this->stats->adjust($userId, $field, -$amount);
            \App\Http\Controllers\DashboardController::invalidateCache($userId);
            return $result;
        });
    }

    public function partialPay(int $userId, int $id, float $amount, ?int $walletId = null): ?Debt
    {
        $debt = $this->repository->findByUser($id, $userId);
        if (! $debt) return null;

        $currentAmount = (float) $debt->amount;

        // If paying full or more, just mark as paid
        if ($amount >= $currentAmount) {
            return $this->markPaid($userId, $id, $walletId);
        }

        return DB::transaction(function () use ($userId, $debt, $amount, $walletId, $currentAmount) {
            // Adjust wallet balance
            if ($walletId) {
                $delta = $debt->type === 'i_owe' ? -$amount : $amount;
                $this->walletRepository->adjustBalance($walletId, $delta);
            }

            // Reduce the debt amount
            $remaining = $currentAmount - $amount;
            $result = $this->repository->update($debt, ['amount' => round($remaining, 2)]);

            // Adjust stats
            $field = $debt->type === 'i_owe' ? 'debts_i_owe' : 'debts_owed_to_me';
            $this->stats->adjust($userId, $field, -$amount);
            \App\Http\Controllers\DashboardController::invalidateCache($userId);

            // If it's a debt I OWE, log partial payment as an expense
            if ($debt->type === 'i_owe') {
                $this->expenseRepository->create([
                    'user_id' => $userId,
                    'title' => "Partial Debt Payment: " . $debt->name,
                    'amount' => $amount,
                    'category' => 'Bills/Debt',
                    'date' => now()->toDateString(),
                    'wallet_id' => $walletId,
                    'description' => 'Partial payment towards debt'
                ]);
                $this->stats->adjust($userId, 'expenses_total', $amount);
            } else {
                // If it's a debt OWED TO ME, log partial payment as a general Income
                DB::table('incomes')->insert([
                    'user_id'     => $userId,
                    'wallet_id'   => $walletId,
                    'amount'      => $amount,
                    'source'      => 'Debt Collection',
                    'date'        => now()->toDateString(),
                    'description' => "Partial Debt Payment from: " . $debt->name,
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            }

            return $result;
        });
    }

    public function delete(int $userId, int $id): bool
    {
        $debt = $this->repository->findByUser($id, $userId);
        if (! $debt) return false;

        return DB::transaction(function () use ($userId, $debt) {
            $this->repository->delete($debt);
            if (! $debt->is_paid) {
                $field = $debt->type === 'i_owe' ? 'debts_i_owe' : 'debts_owed_to_me';
                $this->stats->adjust($userId, $field, -(float) $debt->amount);
            }
            \App\Http\Controllers\DashboardController::invalidateCache($userId);
            return true;
        });
    }
}
