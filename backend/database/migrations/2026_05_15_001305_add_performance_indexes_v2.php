<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('incomes', function (Blueprint $table) {
            // Speed up Dashboard stats filtering by user and date
            $table->index(['user_id', 'date'], 'incomes_user_date_idx');
        });

        Schema::table('wallets', function (Blueprint $table) {
            // Speed up Wallet list and balance lookups
            $table->index('user_id', 'wallets_user_id_idx');
        });

        Schema::table('salary_deposits', function (Blueprint $table) {
            // Additional index for date-based lookups if user doesn't use the month/year columns
            $table->index(['user_id', 'deposited_at'], 'salary_user_deposited_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('incomes', function (Blueprint $table) {
            $table->dropIndex('incomes_user_date_idx');
        });

        Schema::table('wallets', function (Blueprint $table) {
            $table->dropIndex('wallets_user_id_idx');
        });

        Schema::table('salary_deposits', function (Blueprint $table) {
            $table->dropIndex('salary_user_deposited_idx');
        });
    }
};
