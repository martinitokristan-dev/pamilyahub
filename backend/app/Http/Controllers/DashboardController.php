<?php

namespace App\Http\Controllers;

use App\Services\UserStatsService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    use ApiResponse;

    public function __construct(private UserStatsService $stats) {}

    public function stats(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $month = $request->query('month', now()->month);
        $year = $request->query('year', now()->year);

        $stats = $this->stats->get($userId);
        $user = $request->user();
        
        // Calculate dynamic monthly totals
        $stats->expenses_total = (float) \App\Models\Expense::where('user_id', $userId)
            ->whereYear('date', $year)
            ->whereMonth('date', $month)
            ->sum('amount');
            
        $stats->income_total = (float) \App\Models\Income::where('user_id', $userId)
            ->whereYear('date', $year)
            ->whereMonth('date', $month)
            ->sum('amount');

        $salaryDeposits = (float) \App\Models\Income::where('user_id', $userId)
            ->where('source', 'Salary')
            ->whereYear('date', $year)
            ->whereMonth('date', $month)
            ->sum('amount');

        $unallocatedExpenses = (float) \App\Models\Expense::where('user_id', $userId)
            ->whereNull('wallet_id')
            ->whereYear('date', $year)
            ->whereMonth('date', $month)
            ->sum('amount');

        $stats->remaining_salary = max(0, (float) $user->monthly_salary - $salaryDeposits - $unallocatedExpenses);

        return $this->success($stats);
    }
}
