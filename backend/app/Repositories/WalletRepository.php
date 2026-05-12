<?php

namespace App\Repositories;

use App\Models\Wallet;
use Illuminate\Database\Eloquent\Collection;

class WalletRepository
{
    public function getByUser(int $userId): Collection
    {
        return Wallet::where('user_id', $userId)->orderBy('created_at')->get();
    }

    public function findByUser(int $id, int $userId): ?Wallet
    {
        return Wallet::where('id', $id)->where('user_id', $userId)->first();
    }

    public function create(array $data): Wallet
    {
        return Wallet::create($data);
    }

    public function update(Wallet $wallet, array $data): Wallet
    {
        $wallet->update($data);
        return $wallet->fresh();
    }

    public function delete(Wallet $wallet): void
    {
        $wallet->delete();
    }

    public function adjustBalance(int $id, float $delta): void
    {
        Wallet::where('id', $id)->increment('balance', $delta);
    }
}
