<?php

namespace App\Repositories;

use App\Models\Expense;
use Illuminate\Database\Eloquent\Collection;

class ExpenseRepository
{
    public function getByUser(int $userId, array $filters = []): Collection
    {
        $query = Expense::with('wallet')->where('user_id', $userId);

        if (!empty($filters['month']) && !empty($filters['year'])) {
            $startDate = sprintf('%04d-%02d-01', $filters['year'], $filters['month']);
            $endDate = date('Y-m-t', strtotime($startDate));
            $query->whereBetween('date', [$startDate, $endDate]);
        }

        return $query->orderByDesc('date')->orderByDesc('id')->get();
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

    public function getByUserPaginated(int $userId, array $filters = []): \Illuminate\Pagination\LengthAwarePaginator
    {
        $query = Expense::with('wallet')->where('user_id', $userId);

        if (!empty($filters['month']) && !empty($filters['year'])) {
            // Use date-range query instead of whereYear/whereMonth
            // so the expenses_user_date_idx index can be used
            $startDate = sprintf('%04d-%02d-01', $filters['year'], $filters['month']);
            $endDate = date('Y-m-t', strtotime($startDate));
            $query->whereBetween('date', [$startDate, $endDate]);
        }

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('category', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Order by indexed 'date' column instead of 'created_at' for index coverage
        return $query->orderByDesc('date')->orderByDesc('id')->paginate(10);
    }
}
