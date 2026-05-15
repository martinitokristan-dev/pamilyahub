<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

class EncryptSensitiveData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'encrypt:sensitive-data {--dry-run : Preview encryption without saving}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'One-time bulk encryption of sensitive financial and personal data';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        // Check if the NEW columns added in v1.2.2 are encrypted to prevent double-running.
        // We check salary_deposits.already_spent instead of expenses.amount because expenses
        // were encrypted in an earlier pass.
        $sample = DB::table('salary_deposits')->whereNotNull('already_spent')->value('already_spent');

        if ($sample && Str::startsWith((string)$sample, 'eyJ')) {
            $this->info('Data already encrypted. Skipping.');
            return 0;
        }

        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->info('--- DRY RUN MODE ---');
        }

        $tables = [
            'expenses'        => ['amount', 'title', 'description'],
            'wallets'         => ['balance'],
            'users'           => ['monthly_salary'],
            'notes'           => ['title', 'content'],
            'debts'           => ['amount', 'description', 'name'],
            'incomes'         => ['amount', 'source', 'description'],
            'salary_deposits' => ['amount', 'already_spent'],
            'user_stats'      => ['expenses_total', 'debts_owed_to_me', 'debts_i_owe', 'income_total'],
        ];

        DB::transaction(function () use ($tables, $dryRun) {
            foreach ($tables as $table => $columns) {
                $count = DB::table($table)->count();
                $this->info("Processing {$table} ({$count} records)...");

                $processed = 0;
                $orderColumn = $table === 'user_stats' ? 'user_id' : 'id';
                DB::table($table)->orderBy($orderColumn)->chunk(100, function ($records) use ($table, $columns, $dryRun, &$processed, $orderColumn) {
                    foreach ($records as $record) {
                        $updates = [];
                        foreach ($columns as $column) {
                            $value = $record->{$column};

                            // Skip nulls or already encrypted values
                            if (is_null($value) || Str::startsWith((string)$value, 'eyJ')) {
                                continue;
                            }

                            $updates[$column] = Crypt::encryptString((string)$value);
                        }

                        if (!empty($updates)) {
                            if (!$dryRun) {
                                DB::table($table)->where($orderColumn, $record->{$orderColumn})->update($updates);
                            }
                        }
                        $processed++;
                    }
                });

                $this->info("Encrypting {$table}... {$processed}/{$processed} done");
            }

            if ($dryRun) {
                throw new \Exception('Rolling back dry run');
            }
        });

        $this->info('Encryption completed successfully!');
    }
}
