<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('api-logs:prune')->daily();

Schedule::command('finances:archive')
    ->monthlyOn(1, '00:00')
    ->withoutOverlapping()
    ->runInBackground();

Schedule::command('reminders:send')
    ->dailyAt('08:00')
    ->withoutOverlapping()
    ->runInBackground();
