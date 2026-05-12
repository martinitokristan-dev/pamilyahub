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
