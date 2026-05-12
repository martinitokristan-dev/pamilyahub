<?php

namespace App\Services;

use App\Models\Expense;
use App\Repositories\ExpenseRepository;
use App\Repositories\WalletRepository;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class ExpenseService
{
    public function __construct(
        private ExpenseRepository $repository,
        private WalletRepository  $walletRepository,
        private UserStatsService  $stats
    ) {}

    public function getAll(int $userId): Collection
    {
        return $this->repository->getByUser($userId);
    }

    public function create(int $userId, array $data): Expense
    {
        return DB::transaction(function () use ($userId, $data) {
            $data['user_id'] = $userId;
            $expense = $this->repository->create($data);

            if (! empty($data['wallet_id'])) {
                $this->walletRepository->adjustBalance($data['wallet_id'], -(float) $data['amount']);
            }

            $this->stats->adjust($userId, 'expenses_total', (float) $data['amount']);
            return $expense->load('wallet');
        });
    }

    public function update(int $userId, int $id, array $data): ?Expense
    {
        $expense = $this->repository->findByUser($id, $userId);
        if (! $expense) return null;

        return DB::transaction(function () use ($userId, $expense, $data) {
            $oldWalletId = $expense->wallet_id;
            $oldAmount   = (float) $expense->amount;
            $newWalletId = $data['wallet_id'] ?? null;
            $newAmount   = (float) ($data['amount'] ?? $oldAmount);

            // Refund old wallet if any
            if ($oldWalletId) {
                $this->walletRepository->adjustBalance($oldWalletId, $oldAmount);
            }
            // Deduct from new wallet if any
            if ($newWalletId) {
                $this->walletRepository->adjustBalance($newWalletId, -$newAmount);
            }

            $result = $this->repository->update($expense, $data);
            $this->stats->adjust($userId, 'expenses_total', $newAmount - $oldAmount);
            return $result->load('wallet');
        });
    }

    public function delete(int $userId, int $id): bool
    {
        $expense = $this->repository->findByUser($id, $userId);
        if (! $expense) return false;

        return DB::transaction(function () use ($userId, $expense) {
            // Refund wallet on delete
            if ($expense->wallet_id) {
                $this->walletRepository->adjustBalance($expense->wallet_id, (float) $expense->amount);
            }

            $this->repository->delete($expense);
            $this->stats->adjust($userId, 'expenses_total', -(float) $expense->amount);
            return true;
        });
    }
}
