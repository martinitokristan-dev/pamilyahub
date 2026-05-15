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

    public function getByUserPaginated(int $userId, int $perPage = 20, int $page = 1): array
    {
        $paginated = Wallet::where('user_id', $userId)
            ->orderBy('id')
            ->paginate($perPage, ['*'], 'page', $page);
        
        return [
            'data' => $paginated->items(),
            'total' => $paginated->total(),
            'page' => $paginated->currentPage(),
            'per_page' => $paginated->perPage(),
            'last_page' => $paginated->lastPage()
        ];
    }

    public function countByUser(int $userId): int
    {
        return Wallet::where('user_id', $userId)->count();
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
