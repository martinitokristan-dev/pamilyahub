<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Expense;
use App\Models\ExpenseArchive;
use App\Models\Debt;
use App\Models\DebtArchive;
use App\Models\Income;
use App\Models\IncomeArchive;
use Illuminate\Support\Facades\Log;

class ArchiveOldFinances extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'finances:archive';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Moves expenses, debts, and incomes older than 6 months to archive tables';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $cutoff = now()->subMonths(6)->startOfDay();
        $this->info("Archiving finances before {$cutoff->toDateString()}...");

        $this->archiveExpenses($cutoff);
        $this->archiveDebts($cutoff);
        $this->archiveIncomes($cutoff);
        $this->archiveUpcomingPayments($cutoff);

        $this->info("Archiving complete.");
    }

    private function archiveExpenses($cutoff)
    {
        try {
            $totalArchived = 0;
            
            Expense::where('date', '<', $cutoff)
                ->whereNotNull('user_id')
                ->chunkById(200, function ($chunk) use (&$totalArchived) {
                    $archives = [];
                    foreach ($chunk as $expense) {
                        $array = $expense->toArray();
                        $array['archived_at'] = now();
                        $archives[] = $array;
                    }

                    if (!empty($archives)) {
                        ExpenseArchive::upsert($archives, ['id'], collect($archives[0])->keys()->toArray());
                        Expense::whereIn('id', $chunk->pluck('id'))->delete();
                        $totalArchived += count($archives);
                    }
                });

            $this->info("Archived {$totalArchived} expenses.");
        } catch (\Exception $e) {
            Log::error("Failed to archive expenses: " . $e->getMessage());
            $this->error("Failed to archive expenses. Check logs for details.");
        }
    }

    private function archiveDebts($cutoff)
    {
        try {
            $totalArchived = 0;
            
            // Only archive fully paid debts that are old enough
            Debt::where('is_paid', true)
                ->where('updated_at', '<', $cutoff)
                ->whereNotNull('user_id')
                ->chunkById(200, function ($chunk) use (&$totalArchived) {
                    $archives = [];
                    foreach ($chunk as $debt) {
                        $array = $debt->toArray();
                        $array['archived_at'] = now();
                        $archives[] = $array;
                    }

                    if (!empty($archives)) {
                        DebtArchive::upsert($archives, ['id'], collect($archives[0])->keys()->toArray());
                        Debt::whereIn('id', $chunk->pluck('id'))->delete();
                        $totalArchived += count($archives);
                    }
                });

            $this->info("Archived {$totalArchived} debts.");
        } catch (\Exception $e) {
            Log::error("Failed to archive debts: " . $e->getMessage());
            $this->error("Failed to archive debts. Check logs for details.");
        }
    }

    private function archiveIncomes($cutoff)
    {
        try {
            $totalArchived = 0;
            
            Income::where('date', '<', $cutoff)
                ->whereNotNull('user_id')
                ->chunkById(200, function ($chunk) use (&$totalArchived) {
                    $archives = [];
                    foreach ($chunk as $income) {
                        $array = $income->toArray();
                        $array['archived_at'] = now();
                        $archives[] = $array;
                    }

                    if (!empty($archives)) {
                        IncomeArchive::upsert($archives, ['id'], collect($archives[0])->keys()->toArray());
                        Income::whereIn('id', $chunk->pluck('id'))->delete();
                        $totalArchived += count($archives);
                    }
                });

            $this->info("Archived {$totalArchived} incomes.");
        } catch (\Exception $e) {
            Log::error("Failed to archive incomes: " . $e->getMessage());
            $this->error("Failed to archive incomes. Check logs for details.");
        }
    }

    private function archiveUpcomingPayments($cutoff)
    {
        try {
            $totalArchived = 0;
            
            \App\Models\UpcomingPayment::where('is_paid', true)
                ->where('updated_at', '<', $cutoff)
                ->whereNotNull('user_id')
                ->chunkById(200, function ($chunk) use (&$totalArchived) {
                    $archives = [];
                    foreach ($chunk as $payment) {
                        $array = $payment->toArray();
                        $array['archived_at'] = now();
                        $archives[] = $array;
                    }

                    if (!empty($archives)) {
                        \App\Models\UpcomingPaymentArchive::upsert($archives, ['id'], collect($archives[0])->keys()->toArray());
                        \App\Models\UpcomingPayment::whereIn('id', $chunk->pluck('id'))->delete();
                        $totalArchived += count($archives);
                    }
                });

            $this->info("Archived {$totalArchived} upcoming payments.");
        } catch (\Exception $e) {
            Log::error("Failed to archive upcoming payments: " . $e->getMessage());
            $this->error("Failed to archive upcoming payments. Check logs for details.");
        }
    }
}
