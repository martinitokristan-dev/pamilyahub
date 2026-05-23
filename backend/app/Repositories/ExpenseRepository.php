<?php

namespace App\Repositories;

use App\Models\Expense;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\Paginator;

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

        $results = $query->orderByDesc('date')->orderByDesc('id')->get();

        if (!empty($filters['search'])) {
            $search = strtolower($filters['search']);
            $results = $results->filter(function($e) use ($search) {
                return str_contains(strtolower($e->title ?? ''), $search) ||
                       str_contains(strtolower($e->description ?? ''), $search);
            });
        }

        return $results;
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

    public function getByUserPaginated(int $userId, array $filters = []): LengthAwarePaginator
    {
        $query = Expense::with('wallet')->where('user_id', $userId);

        if (!empty($filters['month']) && !empty($filters['year'])) {
            $startDate = sprintf('%04d-%02d-01', $filters['year'], $filters['month']);
            $endDate = date('Y-m-t', strtotime($startDate));
            $query->whereBetween('date', [$startDate, $endDate]);
        }

        // Fetch records for filtering in PHP
        $allResults = $query->orderByDesc('date')->orderByDesc('id')->get();

        if (!empty($filters['search'])) {
            $search = strtolower($filters['search']);
            $allResults = $allResults->filter(function($e) use ($search) {
                return str_contains(strtolower($e->title ?? ''), $search) ||
                       str_contains(strtolower($e->description ?? ''), $search);
            });
        }

        // Manual pagination for the filtered collection
        $perPage = 10;
        $page = Paginator::resolveCurrentPage() ?: 1;
        $items = $allResults->forPage($page, $perPage)->values();

        return new LengthAwarePaginator(
            $items,
            $allResults->count(),
            $perPage,
            $page,
            ['path' => Paginator::resolveCurrentPath()]
        );
    }
}
