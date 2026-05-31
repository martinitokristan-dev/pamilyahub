<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\ApiUsageLog;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

class AdminController extends Controller
{
    public function getApiUsage(Request $request)
    {
        $period = $request->query('period', '24h');

        $startDate = match ($period) {
            '30m'  => Carbon::now()->subMinutes(30),
            '1h'   => Carbon::now()->subHour(),
            '10h'  => Carbon::now()->subHours(10),
            '7d'   => Carbon::now()->subDays(7),
            '30d'  => Carbon::now()->subDays(30),
            default => Carbon::now()->subHours(24),
        };

        // Short periods need a lower cache TTL so the chart feels live
        $cacheTtl = match ($period) {
            '30m'  => 10,
            '1h'   => 15,
            '10h'  => 30,
            default => 60,
        };

        // 1. Unified Usage Statistics
        $usageStats = Cache::remember("api_usage_stats_{$period}", $cacheTtl, function () use ($startDate) {
            return ApiUsageLog::where('created_at', '>=', $startDate)
                ->selectRaw('
                    provider,
                    key_prefix,
                    count(*) as total_requests,
                    sum(tokens_used) as total_tokens,
                    avg(response_time_ms) as avg_response_time,
                    sum(case when status_code >= 400 then 1 else 0 end) as error_count
                ')
                ->groupBy('provider', 'key_prefix')
                ->orderBy('provider', 'asc')
                ->get();
        });

        // RPM query (always fresh at 7 seconds)
        $currentRpm = Cache::remember('api_current_rpm', 7, function () {
            $lastMinute = Carbon::now()->subSeconds(60);
            return ApiUsageLog::where('created_at', '>=', $lastMinute)
                ->selectRaw('provider, key_prefix, count(*) as rpm')
                ->groupBy('provider', 'key_prefix')
                ->get()
                ->keyBy(function ($item) {
                    return $item->provider . '_' . $item->key_prefix;
                });
        });

        foreach ($usageStats as $stat) {
            $key = $stat->provider . '_' . $stat->key_prefix;
            $stat->current_rpm = isset($currentRpm[$key]) ? $currentRpm[$key]->rpm : 0;
        }

        // 2. Recent Errors
        $recentErrors = Cache::remember("api_recent_errors_{$period}", $cacheTtl, function () {
            return ApiUsageLog::where('status_code', '>=', 400)
                ->orderBy('created_at', 'desc')
                ->take(20)
                ->get();
        });

        // 3. Chart Data — bucket granularity matches the selected period
        $chartData = Cache::remember("api_chart_data_{$period}", $cacheTtl, function () use ($startDate, $period) {
            $logs = ApiUsageLog::where('created_at', '>=', $startDate)
                ->get(['provider', 'key_prefix', 'created_at']);

            return $logs->groupBy(function ($log) use ($period) {
                $dt = Carbon::parse($log->created_at)->timezone('Asia/Manila');
                $bucket = match ($period) {
                    '30m'  => $dt->format('H:i'),                           // per minute  → HH:MM
                    '1h'   => $dt->copy()->floorMinutes(5)->format('H:i'),  // per 5 min   → HH:MM
                    '10h'  => $dt->copy()->floorMinutes(30)->format('H:i'), // per 30 min  → HH:MM
                    '24h'  => $dt->format('H'),                             // per hour    → HH
                    default => $dt->format('Y-m-d'),                        // per day     → YYYY-MM-DD
                };
                return $log->provider . '_' . $log->key_prefix . '_' . $bucket;
            })->map(function ($group) use ($period) {
                $first = $group->first();
                $dt    = Carbon::parse($first->created_at)->timezone('Asia/Manila');
                $timeGroup = match ($period) {
                    '30m'  => $dt->format('H:i'),
                    '1h'   => $dt->copy()->floorMinutes(5)->format('H:i'),
                    '10h'  => $dt->copy()->floorMinutes(30)->format('H:i'),
                    '24h'  => $dt->format('H'),
                    default => $dt->format('Y-m-d'),
                };

                return [
                    'provider'   => $first->provider,
                    'key_prefix' => $first->key_prefix,
                    'time_group' => $timeGroup,
                    'count'      => $group->count(),
                ];
            })->values();
        });

        // 4. Full inventory of all configured keys (including unused standbys)
        $configuredKeys = [];

        // Gemini (up to 4)
        $geminiKeysRaw = [];
        for ($i = 1; $i <= 4; $i++) {
            $k = env("GEMINI_API_KEY_{$i}");
            if (!empty($k)) $geminiKeysRaw[] = trim($k);
        }
        if (empty($geminiKeysRaw)) {
            $raw = env('GEMINI_API_KEY');
            if (!empty($raw)) {
                $geminiKeysRaw = array_values(array_filter(array_map('trim', explode(',', $raw))));
            }
        }
        foreach ($geminiKeysRaw as $k) {
            $configuredKeys[] = ['provider' => 'gemini', 'key_prefix' => substr($k, 0, 8)];
        }

        // Groq Qwen (up to 2)
        $qwenKeysRaw = [];
        for ($i = 1; $i <= 2; $i++) {
            $k = env("GROQ_QWEN_API_KEY_{$i}");
            if (!empty($k)) $qwenKeysRaw[] = trim($k);
        }
        if (empty($qwenKeysRaw)) {
            $groqRaw = env('GROQ_API_KEY');
            $groqAll = !empty($groqRaw) ? array_values(array_filter(array_map('trim', explode(',', $groqRaw)))) : [];
            if (count($groqAll) >= 2) $qwenKeysRaw = array_slice($groqAll, 0, 2);
        }
        foreach ($qwenKeysRaw as $k) {
            $configuredKeys[] = ['provider' => 'qwen', 'key_prefix' => substr($k, 0, 8)];
        }

        // Groq Llama (up to 2)
        $llamaKeysRaw = [];
        for ($i = 1; $i <= 2; $i++) {
            $k = env("GROQ_LLAMA_API_KEY_{$i}");
            if (!empty($k)) $llamaKeysRaw[] = trim($k);
        }
        if (empty($llamaKeysRaw)) {
            $groqRaw = env('GROQ_API_KEY');
            $groqAll = !empty($groqRaw) ? array_values(array_filter(array_map('trim', explode(',', $groqRaw)))) : [];
            if (count($groqAll) >= 4) $llamaKeysRaw = array_slice($groqAll, 2, 2);
            elseif (count($groqAll) >= 2) $llamaKeysRaw = array_slice($groqAll, 0, 2);
            else $llamaKeysRaw = $groqAll;
        }
        foreach ($llamaKeysRaw as $k) {
            $configuredKeys[] = ['provider' => 'llama', 'key_prefix' => substr($k, 0, 8)];
        }

        return response()->json([
            'usage_stats'     => $usageStats,
            'recent_errors'   => $recentErrors,
            'chart_data'      => $chartData,
            'configured_keys' => $configuredKeys,
            'period'          => $period,
        ]);
    }
}
