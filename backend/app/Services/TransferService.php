<?php

namespace App\Services;

use App\Models\Transfer;
use App\Repositories\TransferRepository;
use App\Repositories\WalletRepository;
use Illuminate\Support\Facades\DB;

class TransferService
{
    public function __construct(
        private TransferRepository $repository,
        private WalletRepository $walletRepository,
        private \App\Services\DashboardCacheService $cache
    ) {}

    public function create(int $userId, array $data): Transfer
    {
        return DB::transaction(function () use ($userId, $data) {
            $data['user_id'] = $userId;
            
            // Deduct from source wallet
            $this->walletRepository->adjustBalance($data['from_wallet_id'], -(float)$data['amount']);
            
            // Add to destination wallet
            $this->walletRepository->adjustBalance($data['to_wallet_id'], (float)$data['amount']);
            
            $transfer = $this->repository->create($data);

            $this->cache->invalidate($userId);
            return $transfer;
        });
    }
}
