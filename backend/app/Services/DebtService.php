<?php

namespace App\Services;

use App\Models\Debt;
use App\Repositories\DebtRepository;
use App\Repositories\WalletRepository;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class DebtService
{
    public function __construct(
        private DebtRepository   $repository,
        private WalletRepository $walletRepository,
        private UserStatsService $stats
    ) {}

    public function getAll(int $userId): Collection
    {
        return $this->repository->getByUser($userId);
    }

    public function create(int $userId, array $data): Debt
    {
        $data['user_id'] = $userId;
        $debt = $this->repository->create($data);
        $field = $data['type'] === 'i_owe' ? 'debts_i_owe' : 'debts_owed_to_me';
        $this->stats->adjust($userId, $field, (float) $data['amount']);
        return $debt;
    }

    public function update(int $userId, int $id, array $data): ?Debt
    {
        $debt = $this->repository->findByUser($id, $userId);

        if (! $debt) {
            return null;
        }

        $result = $this->repository->update($debt, $data);
        // Recalculate since type or amount might have changed
        $this->stats->recalculate($userId);
        return $result;
    }

    public function markPaid(int $userId, int $id, ?int $walletId = null): ?Debt
    {
        $debt = $this->repository->findByUser($id, $userId);
        if (! $debt) return null;

        return DB::transaction(function () use ($userId, $debt, $walletId) {
            if ($walletId) {
                $amount = (float) $debt->amount;
                // i_owe → deduct; owed_to_me → receive (add)
                $delta = $debt->type === 'i_owe' ? -$amount : $amount;
                $this->walletRepository->adjustBalance($walletId, $delta);
            }
            $result = $this->repository->update($debt, ['is_paid' => true]);
            // Subtract from the appropriate debt field
            $field = $debt->type === 'i_owe' ? 'debts_i_owe' : 'debts_owed_to_me';
            $this->stats->adjust($userId, $field, -(float) $debt->amount);
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

            return $result;
        });
    }

    public function delete(int $userId, int $id): bool
    {
        $debt = $this->repository->findByUser($id, $userId);

        if (! $debt) {
            return false;
        }

        $this->repository->delete($debt);
        // Only subtract if unpaid
        if (! $debt->is_paid) {
            $field = $debt->type === 'i_owe' ? 'debts_i_owe' : 'debts_owed_to_me';
            $this->stats->adjust($userId, $field, -(float) $debt->amount);
        }
        return true;
    }
}
