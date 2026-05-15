<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Models\Income;
use App\Models\SalaryDeposit;
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

            $expensesTotal = (float) $expenses->sum(fn($e) => (float) $e->amount);
            $unallocatedTotal = (float) $expenses
                ->whereNull('wallet_id')
                ->sum(fn($e) => (float) $e->amount);

            // Fetch and aggregate Salary Deposits in PHP
            $salaryData = SalaryDeposit::where('user_id', $userId)
                ->where('year', $year)
                ->where('month', $month)
                ->get()
                ->sum(fn($s) => (float) $s->amount);

            // Fetch and aggregate Other Income in PHP
            $otherIncome = Income::where('user_id', $userId)
                ->whereBetween('date', [$startDate, $endDate])
                ->get()
                ->sum(fn($i) => (float) $i->amount);

            $totalIncome = (float) $salaryData + (float) $otherIncome;

            $stats->expenses_total   = $expensesTotal;
            $stats->income_total     = $totalIncome;
            $stats->remaining_salary = $totalIncome - $expensesTotal;
            
            // Add unallocated if needed by frontend (currently used in DashboardController query but not returned in object properties explicitly, though stats is dynamic)
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
