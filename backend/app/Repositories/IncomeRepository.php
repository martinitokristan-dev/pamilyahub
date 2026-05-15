<?php

namespace App\Repositories;

use App\Models\Income;
use Illuminate\Database\Eloquent\Collection;

class IncomeRepository
{
    public function getByUser(int $userId): Collection
    {
        return Income::with('wallet')->where('user_id', $userId)->latest()->get();
    }

    public function findById(int $id): ?Income
    {
        return Income::find($id);
    }

    public function update(Income $income, array $data): bool
    {
        return $income->update($data);
    }

    public function delete(Income $income): bool
    {
        return $income->delete();
    }
}
