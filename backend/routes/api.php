<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DebtController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\FileController;
use App\Http\Controllers\NoteController;
use App\Http\Controllers\NoteFolderController;
use App\Http\Controllers\IncomeController;
use App\Http\Controllers\SalaryDepositController;
use App\Http\Controllers\WalletController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AiTrainingLogController;
use Illuminate\Support\Facades\Route;

Route::get('/ping', fn() => response()->json(['status' => 'ok']));

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/login-with-data', [AuthController::class, 'loginWithData']);
    Route::post('/google', [AuthController::class, 'googleLogin']);

    Route::middleware(['auth:sanctum', 'track_activity'])->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::patch('/profile', [AuthController::class, 'updateProfile']);
        Route::post('/profile/avatar', [AuthController::class, 'uploadAvatar']);
        Route::delete('/profile/avatar', [AuthController::class, 'deleteAvatar']);
        Route::get('/sessions', [AuthController::class, 'getSessions']);
        Route::post('/sessions/logout-others', [AuthController::class, 'logoutOtherSessions']);
        Route::delete('/sessions/{id}', [AuthController::class, 'revokeSession']);
    });
});

Route::middleware(['auth:sanctum', 'track_activity'])->group(function () {
    // Push Notifications
    Route::get('/push/status', [\App\Http\Controllers\PushSubscriptionController::class, 'status']);
    Route::post('/push/subscribe', [\App\Http\Controllers\PushSubscriptionController::class, 'subscribe']);
    Route::delete('/push/unsubscribe', [\App\Http\Controllers\PushSubscriptionController::class, 'unsubscribe']);

    Route::get('dashboard/stats', [DashboardController::class, 'stats']);

    Route::apiResource('notes', NoteController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::apiResource('note-folders', NoteFolderController::class)->only(['index', 'store', 'destroy']);
    Route::get('expenses/feed', [ExpenseController::class, 'feed']);
    Route::apiResource('expenses', ExpenseController::class)->only(['store', 'update', 'destroy']);
    Route::post('expenses/{id}/archive', [ExpenseController::class, 'archive']);
    Route::apiResource('files', FileController::class)->only(['index', 'store', 'destroy']);

    Route::get('debts/feed', [DebtController::class, 'feed']);
    Route::apiResource('debts', DebtController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::post('debts/{id}/archive', [DebtController::class, 'archive']);
    Route::patch('debts/{id}/mark-paid', [DebtController::class, 'markPaid']);
    Route::patch('debts/{id}/partial-pay', [DebtController::class, 'partialPay']);

    Route::apiResource('wallets', WalletController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::get('wallets/{id}/feed', [WalletController::class, 'feed']);
    Route::post('incomes/deposit-salary', [IncomeController::class, 'depositSalary']);
    Route::post('incomes/{id}/archive', [IncomeController::class, 'archive']);

    // Salary Deposits
    Route::get('salary-deposits/current-month', [SalaryDepositController::class, 'currentMonth']);
    Route::post('salary-deposits', [SalaryDepositController::class, 'store']);

    // AI Chat Support (with automatic failover)
    Route::post('chat/message', [ChatController::class, 'message']);
    Route::post('chat/interpret', [ChatController::class, 'interpret']);
    Route::get('chat/rules', [ChatController::class, 'getRules']);
    Route::post('chat/log-action', [ChatController::class, 'logAction']);
    // Transfers
    Route::post('transfers', [\App\Http\Controllers\TransferController::class, 'store']);
    Route::post('transfers/{id}/archive', [\App\Http\Controllers\TransferController::class, 'archive']);

    // Upcoming Payments (Plans)
    Route::apiResource('upcoming-payments', \App\Http\Controllers\UpcomingPaymentController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::patch('upcoming-payments/{id}/mark-paid', [\App\Http\Controllers\UpcomingPaymentController::class, 'markPaid']);

    // Admin Dashboard
    Route::middleware(['is_admin'])->group(function () {
        Route::get('admin/api-usage', [AdminController::class, 'getApiUsage']);

        // AI Training Logs (restricted to martinitokristan@gmail.com only via is_admin middleware)
        Route::get('admin/ai-logs', [AiTrainingLogController::class, 'index']);
        Route::post('admin/ai-logs/mark-reviewed', [AiTrainingLogController::class, 'markReviewed']);
        Route::delete('admin/ai-logs/clear-reviewed', [AiTrainingLogController::class, 'clearReviewed']);
    });
});

