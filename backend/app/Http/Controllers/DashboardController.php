<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Models\Income;
use App\Models\IncomeArchive;
use App\Services\UserStatsService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

class DashboardController extends Controller
{
    use ApiResponse;

    public function __construct(private UserStatsService $stats) {}

    public function stats(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $month = $request->query('month', now()->month);
        $year = $request->query('year', now()->year);
        $startDateParam = $request->query('start_date');
        $endDateParam = $request->query('end_date');

        if ($startDateParam && $endDateParam) {
            $startDate = $startDateParam;
            $endDate = $endDateParam;
            $cacheKey = "dashboard_stats_{$userId}_{$startDate}_{$endDate}";
        } else {
            $startDate = sprintf('%04d-%02d-01', $year, $month);
            $endDate = date('Y-m-t', strtotime($startDate));
            $cacheKey = "dashboard_stats_{$userId}_{$year}_{$month}";
        }

        $data = Cache::remember($cacheKey, 120, function () use ($userId, $startDate, $endDate, $request) {
            $stats = $this->stats->get($userId);

            // Fetch and aggregate Expenses in PHP
            $expenses = Expense::where('user_id', $userId)
                ->whereBetween('date', [$startDate, $endDate])
                ->get();

            $expensesTotal = (float) $expenses->where('is_settled', false)->sum(fn($e) => (float) $e->amount);
            $unallocatedTotal = (float) $expenses
                ->where('is_settled', false)
                ->whereNull('wallet_id')
                ->sum(fn($e) => (float) $e->amount);

            // Calculate total wallet balance (cumulative, not month-specific)
            $totalWalletBalance = (float) \App\Models\Wallet::where('user_id', $userId)
                ->get()
                ->sum(fn($w) => (float) $w->balance);

            // Sum active incomes and archives for the selected range (deposits write to `incomes`)
            $totalIncome = 0.0;
            if (\App\Support\ArchivedFeedQuery::tableExists('incomes')) {
                $totalIncome += (float) Income::where('user_id', $userId)
                    ->whereBetween('date', [$startDate, $endDate])
                    ->get()
                    ->sum(fn ($i) => (float) $i->amount);
            }
            if (\App\Support\ArchivedFeedQuery::tableExists('income_archives')) {
                $totalIncome += (float) IncomeArchive::where('user_id', $userId)
                    ->whereBetween('date', [$startDate, $endDate])
                    ->get()
                    ->sum(fn ($i) => (float) $i->amount);
            }

            $stats->monthly_expenses = $expensesTotal;
            $stats->monthly_income   = $totalIncome;
            $stats->remaining_salary = $totalWalletBalance;
            
            // Add unallocated if needed by frontend
            $stats->unallocated_expenses = $unallocatedTotal;

            return $stats;
        });

        return $this->success($data);
    }

    public static function invalidateCache(int $userId, ?int $year = null, ?int $month = null): void
    {
        app(\App\Services\DashboardCacheService::class)->invalidate($userId, $year, $month);
    }
}
