<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DebtController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\FileController;
use App\Http\Controllers\NoteController;
use App\Http\Controllers\NoteFolderController;
use App\Http\Controllers\IncomeController;
use App\Http\Controllers\WalletController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::patch('/profile', [AuthController::class, 'updateProfile']);
    });
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('dashboard/stats', [DashboardController::class, 'stats']);

    Route::apiResource('notes', NoteController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::apiResource('note-folders', NoteFolderController::class)->only(['index', 'store', 'destroy']);
    Route::apiResource('expenses', ExpenseController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::apiResource('files', FileController::class)->only(['index', 'store', 'destroy']);

    Route::apiResource('debts', DebtController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::patch('debts/{id}/mark-paid', [DebtController::class, 'markPaid']);
    Route::patch('debts/{id}/partial-pay', [DebtController::class, 'partialPay']);

    Route::apiResource('wallets', WalletController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::post('incomes/deposit-salary', [IncomeController::class, 'depositSalary']);
});
