<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\UserStatsService;
use Illuminate\Console\Command;

class RecalculateStats extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'stats:recalculate';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Recalculate all user statistics (notes, expenses, income, debts, files)';

    /**
     * Execute the console command.
     */
    public function handle(UserStatsService $statsService)
    {
        $users = User::all();
        $count = $users->count();

        $this->info("Starting recalculation for {$count} users...");

        $users->each(function ($user) use ($statsService) {
            $statsService->recalculate($user->id);
            $this->info("Recalculated stats for user {$user->id} ({$user->name})");
        });

        $this->info('Recalculation complete.');
    }
}
