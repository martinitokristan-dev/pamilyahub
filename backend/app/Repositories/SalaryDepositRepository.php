<?php

namespace App\Repositories;

use App\Models\SalaryDeposit;

class SalaryDepositRepository
{
    /**
     * Find the most recent deposit for a user in a given month/year.
     */
    public function findForMonth(int $userId, int $month, int $year): ?SalaryDeposit
    {
        return SalaryDeposit::where('user_id', $userId)
            ->where('month', $month)
            ->where('year', $year)
            ->latest('deposited_at')
            ->first();
    }

    /**
     * Get all deposits for a user in a given month/year.
     */
    public function getForMonth(int $userId, int $month, int $year)
    {
        return SalaryDeposit::where('user_id', $userId)
            ->where('month', $month)
            ->where('year', $year)
            ->orderBy('deposited_at')
            ->get();
    }

    public function create(array $data): SalaryDeposit
    {
        return SalaryDeposit::create($data);
    }

    /**
     * Sum of already_spent for a user in a given month/year.
     * already_spent is NOT encrypted, so SQL sum works fine.
     */
    public function sumAlreadySpent(int $userId, int $month, int $year): float
    {
        return (float) SalaryDeposit::where('user_id', $userId)
            ->where('month', $month)
            ->where('year', $year)
            ->sum('already_spent');
    }

    /**
     * Sum of amount (encrypted) for a user in a given month/year.
     * Replaced SQL sum() with PHP-side aggregation.
     */
    public function sumAmount(int $userId, int $month, int $year): float
    {
        return (float) SalaryDeposit::where('user_id', $userId)
            ->where('month', $month)
            ->where('year', $year)
            ->get()
            ->sum(fn($s) => (float) $s->amount);
    }
}
