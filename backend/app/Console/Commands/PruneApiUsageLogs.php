<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

use App\Models\ApiUsageLog;
use Carbon\Carbon;

class PruneApiUsageLogs extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'api-logs:prune';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Prune API usage logs older than 30 days';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $thirtyDaysAgo = Carbon::now()->subDays(30);
        $deleted = ApiUsageLog::where('created_at', '<', $thirtyDaysAgo)->delete();
        $this->info("Deleted {$deleted} old API usage logs.");
    }
}
