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

    public function getAllPaginated(int $userId, int $perPage = 20, int $page = 1): array
    {
        return $this->repository->getByUserPaginated($userId, $perPage, $page);
    }

    public function create(int $userId, array $data): Wallet
    {
        $data['user_id'] = $userId;
        $data['type'] = $this->normalizeType($data['type'] ?? null, $data['name'] ?? null);
        return $this->repository->create($data);
    }

    public function update(int $userId, int $id, array $data): ?Wallet
    {
        $wallet = $this->repository->findByUser($id, $userId);
        if (! $wallet) return null;
        if (array_key_exists('type', $data)) {
            $data['type'] = $this->normalizeType($data['type'], $data['name'] ?? $wallet->name);
        }
        return $this->repository->update($wallet, $data);
    }

    private function normalizeType(?string $type, ?string $name = null): string
    {
        $aliases = [
            'coins' => 'coins_ph',
            'coinsph' => 'coins_ph',
            'coins.ph' => 'coins_ph',
            'gotime' => 'gotyme',
            'shopee' => 'shopeepay',
            'credit card' => 'credit_card',
            'debit card' => 'debit_card',
        ];

        $known = [
            'cash', 'gcash', 'maya', 'bpi', 'bdo', 'unionbank', 'metrobank',
            'credit_card', 'debit_card', 'shopeepay', 'coins_ph', 'gotyme', 'maribank',
        ];

        $candidates = array_filter([$type, $name]);
        foreach ($candidates as $raw) {
            $t = strtolower(trim((string) $raw));
            $t = str_replace(['-', ' '], '_', $t);
            if (isset($aliases[$t])) {
                $t = $aliases[$t];
            }
            if (in_array($t, $known, true)) {
                return $t;
            }
            usort($known, fn ($a, $b) => strlen($b) <=> strlen($a));
            foreach ($known as $id) {
                $needle = str_replace('_', '', $id);
                if (str_contains($t, $id) || ($needle !== '' && str_contains($t, $needle))) {
                    return $id;
                }
            }
        }

        return 'cash';
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
