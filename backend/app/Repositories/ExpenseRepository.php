<?php

namespace App\Repositories;

use App\Models\Expense;
use Illuminate\Database\Eloquent\Collection;

class ExpenseRepository
{
    public function getByUser(int $userId): Collection
    {
        return Expense::with('wallet')->where('user_id', $userId)->latest()->get();
    }

    public function findByUser(int $id, int $userId): ?Expense
    {
        return Expense::with('wallet')->where('id', $id)->where('user_id', $userId)->first();
    }

    public function create(array $data): Expense
    {
        return Expense::create($data);
    }

    public function update(Expense $expense, array $data): Expense
    {
        $expense->update($data);
        return $expense->fresh();
    }

    public function delete(Expense $expense): void
    {
        $expense->delete();
    }
}
