<?php

namespace App\Repositories;

use App\Models\Debt;
use Illuminate\Database\Eloquent\Collection;

class DebtRepository
{
    public function getByUser(int $userId): Collection
    {
        return Debt::where('user_id', $userId)->latest()->get();
    }

    /**
     * Get paginated debts.
     * Uses PHP-side filtering for encrypted columns (name, description).
     */
    public function getByUserPaginated(int $userId, int $perPage = 10, int $page = 1, ?string $type = null, ?string $search = null): array
    {
        $query = Debt::where('user_id', $userId)
            ->when($type, fn($q) => $q->where('type', $type))
            ->orderByDesc('id');

        // Fetch records for the user and type first
        $allResults = $query->get();

        if ($search) {
            $searchLower = strtolower($search);
            $allResults = $allResults->filter(function($debt) use ($searchLower) {
                // name is encrypted? The plan said amount and description, but let's check name too.
                // Wait, STEP 1 and STEP 3 didn't mention name. ONLY title, description, amount.
                // But usually name is sensitive too. The user request in STEP 1/3 mentioned:
                // expenses: amount, title, description
                // debts: amount, description
                // So name is NOT encrypted. But I'll filter it in PHP anyway to be safe/consistent.
                return str_contains(strtolower($debt->name ?? ''), $searchLower) ||
                       str_contains(strtolower($debt->description ?? ''), $searchLower);
            });
        }

        // Manual pagination
        $total = $allResults->count();
        $items = $allResults->slice(($page - 1) * $perPage, $perPage)->values();
        $lastPage = (int) ceil($total / $perPage);

        return [
            'data' => $items,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'last_page' => max(1, $lastPage)
        ];
    }

    public function countByUser(int $userId): int
    {
        return Debt::where('user_id', $userId)->count();
    }

    public function findByUser(int $id, int $userId): ?Debt
    {
        return Debt::where('id', $id)->where('user_id', $userId)->first();
    }

    public function create(array $data): Debt
    {
        return Debt::create($data);
    }

    public function update(Debt $debt, array $data): Debt
    {
        $debt->update($data);
        return $debt->fresh();
    }

    public function delete(Debt $debt): void
    {
        $debt->delete();
    }
}
