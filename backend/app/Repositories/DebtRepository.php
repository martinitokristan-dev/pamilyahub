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

    public function getByUserPaginated(int $userId, int $perPage = 10, int $page = 1, ?string $type = null, ?string $search = null): array
    {
        $query = Debt::where('user_id', $userId)
            ->when($type, fn($q) => $q->where('type', $type))
            ->when($search, function($q) use ($search) {
                $q->where(function($sq) use ($search) {
                    $sq->where('name', 'like', "%{$search}%")
                       ->orWhere('description', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('id');

        $paginated = $query->paginate($perPage, ['*'], 'page', $page);

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
