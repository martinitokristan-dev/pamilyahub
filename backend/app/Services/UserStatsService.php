<?php

namespace App\Services;

use App\Models\Debt;
use App\Models\Expense;
use App\Models\File;
use App\Models\Note;
use App\Models\UserStat;
use App\Models\SalaryDeposit;
use App\Models\Income;

class UserStatsService
{
    public function recalculate(int $userId): void
    {
        UserStat::updateOrCreate(
            ['user_id' => $userId],
            [
                'notes_count'      => Note::where('user_id', $userId)->count(),
                'expenses_total'   => (float) Expense::where('user_id', $userId)
                    ->get()
                    ->sum(fn($e) => (float) $e->amount),
                'income_total'     => (float) Income::where('user_id', $userId)
                    ->get()->sum(fn($i) => (float) $i->amount),
                'debts_owed_to_me' => (float) Debt::where('user_id', $userId)
                    ->where('type', 'owed_to_me')
                    ->where('is_paid', false)
                    ->get()
                    ->sum(fn($d) => (float) $d->amount),
                'debts_i_owe'      => (float) Debt::where('user_id', $userId)
                    ->where('type', 'i_owe')
                    ->where('is_paid', false)
                    ->get()
                    ->sum(fn($d) => (float) $d->amount),
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
                'income_total'     => 0,
                'debts_owed_to_me' => 0,
                'debts_i_owe'      => 0,
                'files_count'      => 0,
            ]
        );
    }

    /**
     * Incremental update for stats.
     * Since fields are encrypted in models, we fetch-calculate-save.
     * (Note: UserStat fields themselves are NOT encrypted, but models being summed ARE)
     */
    public function adjust(int $userId, string $field, float $delta): void
    {
        $stat = $this->get($userId);
        
        // TiDB / Encryption Note: We use PHP-side max(0, ...) instead of DB::raw("GREATEST")
        $stat->$field = max(0, (float) $stat->$field + $delta);
        $stat->save();
    }
}
