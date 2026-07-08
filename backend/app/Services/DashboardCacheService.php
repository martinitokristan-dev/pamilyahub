<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class DashboardCacheService
{
    public function invalidate(int $userId, ?int $year = null, ?int $month = null): void
    {
        $year  = $year  ?? now()->year;
        $month = $month ?? now()->month;
        Cache::forget("dashboard_stats_{$userId}_{$year}_{$month}");
    }
}
