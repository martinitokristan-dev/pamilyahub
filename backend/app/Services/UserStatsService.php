<?php

namespace App\Services;

use App\Models\Debt;
use App\Models\Expense;
use App\Models\File;
use App\Models\Note;
use App\Models\UserStat;
use Illuminate\Support\Facades\DB;

class UserStatsService
{
    public function recalculate(int $userId): void
    {
        UserStat::updateOrCreate(
            ['user_id' => $userId],
            [
                'notes_count'      => Note::where('user_id', $userId)->count(),
                'expenses_total'   => (float) Expense::where('user_id', $userId)->sum('amount'),
                'debts_owed_to_me' => (float) Debt::where('user_id', $userId)
                    ->where('type', 'owed_to_me')
                    ->where('is_paid', false)
                    ->sum('amount'),
                'debts_i_owe'      => (float) Debt::where('user_id', $userId)
                    ->where('type', 'i_owe')
                    ->where('is_paid', false)
                    ->sum('amount'),
                'files_count'      => File::where('user_id', $userId)->count(),
            ]
        );
    }

    public function get(int $userId): UserStat
    {
        return UserStat::firstOrCreate(
            ['user_id' => $userId],
            [
                'notes_count'      => 0,
                'expenses_total'   => 0,
                'debts_owed_to_me' => 0,
                'debts_i_owe'      => 0,
                'files_count'      => 0,
            ]
        );
    }

    /**
     * Incremental single-query update — much faster than recalculate().
     * Ensures the stats row exists first, then applies the delta atomically.
     */
    public function adjust(int $userId, string $field, float $delta): void
    {
        DB::table('user_stats')->insertOrIgnore([
            'user_id'          => $userId,
            'notes_count'      => 0,
            'expenses_total'   => 0,
            'debts_owed_to_me' => 0,
            'debts_i_owe'      => 0,
            'files_count'      => 0,
        ]);

        $d = number_format($delta, 4, '.', '');
        DB::table('user_stats')
            ->where('user_id', $userId)
            ->update([$field => DB::raw("GREATEST(0, `{$field}` + {$d})")]);
    }
}
