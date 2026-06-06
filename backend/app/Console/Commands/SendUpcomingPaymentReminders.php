<?php

namespace App\Console\Commands;

use App\Models\UpcomingPayment;
use App\Services\WebPushService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SendUpcomingPaymentReminders extends Command
{
    protected $signature   = 'reminders:send';
    protected $description = 'Send push notification reminders for upcoming payments (7 days and 2 days before due)';

    public function handle(WebPushService $pushService): void
    {
        $today = Carbon::today();
        $targets = [7, 2]; // days before due date

        foreach ($targets as $daysAhead) {
            $targetDate = $today->copy()->addDays($daysAhead)->toDateString();

            // Query upcoming payments due on this date that are NOT yet paid
            // Using DB::table for raw access (bypasses Eloquent encryption issues)
            $payments = DB::table('upcoming_payments')
                ->where('is_paid', false)
                ->whereDate('due_date', $targetDate)
                ->select('id', 'user_id', 'title', 'amount', 'due_date', 'recurrence')
                ->get();

            foreach ($payments as $payment) {
                try {
                    // Decrypt title
                    $title = $payment->title;
                    try {
                        $title = \Illuminate\Support\Facades\Crypt::decryptString($title);
                    } catch (\Exception) {
                        // plain text
                    }

                    // Decrypt amount
                    $amount = $payment->amount;
                    try {
                        $amount = \Illuminate\Support\Facades\Crypt::decryptString($amount);
                    } catch (\Exception) {
                        // plain text
                    }

                    $formattedAmount = '₱' . number_format((float) $amount, 2);
                    $dueDateFormatted = Carbon::parse($payment->due_date)->format('M j');

                    $notifTitle = $daysAhead === 2
                        ? "⚠️ Payment due in 2 days!"
                        : "📅 Upcoming payment in 7 days";

                    $notifBody = "{$title} — {$formattedAmount} due on {$dueDateFormatted}";

                    $pushService->sendToUser(
                        userId: $payment->user_id,
                        title: $notifTitle,
                        body: $notifBody,
                        data: ['payment_id' => $payment->id]
                    );

                    $this->info("Sent reminder for payment #{$payment->id} ({$title}) to user #{$payment->user_id}");
                    Log::info("Reminder sent: payment #{$payment->id} ({$daysAhead}d) → user #{$payment->user_id}");
                } catch (\Throwable $e) {
                    $this->error("Failed for payment #{$payment->id}: " . $e->getMessage());
                    Log::error("Reminder failed: payment #{$payment->id} → " . $e->getMessage());
                }
            }

            $this->info("Processed " . count($payments) . " payments due in {$daysAhead} days ({$targetDate})");
        }

        $this->info('Done sending reminders.');
    }
}
