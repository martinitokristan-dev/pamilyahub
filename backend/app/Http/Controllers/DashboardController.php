<?php

namespace App\Http\Controllers;

use App\Services\UserStatsService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

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
            $user = $request->user();

            $startDate = sprintf('%04d-%02d-01 00:00:00', $year, $month);
            $endDate = date('Y-m-t 23:59:59', strtotime($startDate));

            // ONE query for all expense aggregates
            $monthly = DB::table('expenses')
                ->selectRaw('COALESCE(SUM(amount), 0) as expenses_total')
                ->selectRaw('COALESCE(SUM(CASE WHEN wallet_id IS NULL THEN amount ELSE 0 END), 0) as unallocated_expenses')
                ->where('user_id', $userId)
                ->whereBetween('date', [$startDate, $endDate])
                ->first();

            // Total Income from salary_deposits table
            $salaryData = DB::table('salary_deposits')
                ->where('user_id', $userId)
                ->where('year', $year)
                ->where('month', $month)
                ->sum('amount');

            // Total Income from general incomes table
            $otherIncome = DB::table('incomes')
                ->where('user_id', $userId)
                ->whereBetween('date', [$startDate, $endDate])
                ->sum('amount');

            $totalIncome = (float) $salaryData + (float) $otherIncome;

            $stats->expenses_total   = (float) $monthly->expenses_total;
            $stats->income_total     = $totalIncome;
            $stats->remaining_salary = $totalIncome - (float) $stats->expenses_total;

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
