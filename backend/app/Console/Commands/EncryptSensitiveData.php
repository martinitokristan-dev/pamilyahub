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
        $sample = DB::table('expenses')->whereNotNull('amount')->value('amount');

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
            'debts'           => ['amount', 'description'],
            'incomes'         => ['amount'],
            'salary_deposits' => ['amount'],
        ];

        DB::transaction(function () use ($tables, $dryRun) {
            foreach ($tables as $table => $columns) {
                $count = DB::table($table)->count();
                $this->info("Processing {$table} ({$count} records)...");

                $processed = 0;
                DB::table($table)->orderBy('id')->chunk(100, function ($records) use ($table, $columns, $dryRun, &$processed) {
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
                                DB::table($table)->where('id', $record->id)->update($updates);
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
