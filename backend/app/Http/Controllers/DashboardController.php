<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Models\Income;
use App\Services\UserStatsService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class DashboardController extends Controller
{
    use ApiResponse;

    public function __construct(private UserStatsService $stats) {}

    public function stats(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $month = $request->query('month', now()->month);
        $year = $request->query('year', now()->year);

        $cacheKey = "dashboard_stats_{$userId}_{$year}_{$month}";

        $data = Cache::remember($cacheKey, 120, function () use ($userId, $month, $year, $request) {
            $stats = $this->stats->get($userId);

            $startDate = sprintf('%04d-%02d-01', $year, $month);
            $endDate = date('Y-m-t', strtotime($startDate));

            // Fetch and aggregate Expenses in PHP
            $expenses = Expense::where('user_id', $userId)
                ->whereBetween('date', [$startDate, $endDate])
                ->get();

            $expensesTotal = (float) $expenses->where('is_settled', false)->sum(fn($e) => (float) $e->amount);
            $unallocatedTotal = (float) $expenses
                ->where('is_settled', false)
                ->whereNull('wallet_id')
                ->sum(fn($e) => (float) $e->amount);

            // Fetch and aggregate Income in PHP (Income is single source of truth)
            $totalIncome = Income::where('user_id', $userId)
                ->whereBetween('date', [$startDate, $endDate])
                ->get()
                ->sum(fn($i) => (float) $i->amount);

            $stats->monthly_expenses = $expensesTotal;
            $stats->monthly_income   = $totalIncome;
            $stats->remaining_salary = $totalIncome - $expensesTotal;
            
            // Add unallocated if needed by frontend
            $stats->unallocated_expenses = $unallocatedTotal;

            return $stats;
        });

        return $this->success($data);
    }

    public static function invalidateCache(int $userId, ?int $year = null, ?int $month = null): void
    {
        $year = $year ?? now()->year;
        $month = $month ?? now()->month;
        $cacheKey = "dashboard_stats_{$userId}_{$year}_{$month}";
        Cache::forget($cacheKey);
    }
}
