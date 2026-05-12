<?php

namespace App\Services;

use App\Models\Wallet;
use App\Repositories\WalletRepository;
use Illuminate\Database\Eloquent\Collection;

class WalletService
{
    public function __construct(
        private WalletRepository $repository,
    ) {}

    public function getAll(int $userId): Collection
    {
        return $this->repository->getByUser($userId);
    }

    public function create(int $userId, array $data): Wallet
    {
        $data['user_id'] = $userId;
        return $this->repository->create($data);
    }

    public function update(int $userId, int $id, array $data): ?Wallet
    {
        $wallet = $this->repository->findByUser($id, $userId);
        if (! $wallet) return null;
        return $this->repository->update($wallet, $data);
    }

    public function delete(int $userId, int $id): bool
    {
        $wallet = $this->repository->findByUser($id, $userId);
        if (! $wallet) return false;
        $this->repository->delete($wallet);
        return true;
    }

    public function adjustBalance(int $walletId, float $delta): void
    {
        $this->repository->adjustBalance($walletId, $delta);
    }
}
