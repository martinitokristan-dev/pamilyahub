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

            // ONE query for all expense aggregates
            $monthly = DB::table('expenses')
                ->selectRaw('COALESCE(SUM(amount), 0) as expenses_total')
                ->selectRaw('COALESCE(SUM(CASE WHEN wallet_id IS NULL THEN amount ELSE 0 END), 0) as unallocated_expenses')
                ->where('user_id', $userId)
                ->whereYear('date', $year)
                ->whereMonth('date', $month)
                ->first();

            // ONE query for all income aggregates from salary_deposits table
            $salaryData = DB::table('salary_deposits')
                ->selectRaw('COALESCE(SUM(amount), 0) as total_deposited')
                ->where('user_id', $userId)
                ->whereYear('deposited_at', $year)
                ->whereMonth('deposited_at', $month)
                ->first();

            $stats->expenses_total   = (float) $monthly->expenses_total;
            $stats->income_total     = (float) $salaryData->total_deposited;
            $stats->remaining_salary = (float) $salaryData->total_deposited - (float) $stats->expenses_total;

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
