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
        // 1. Optimize Expenses: (user_id, date, id)
        // This covers WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC, id DESC
        Schema::table('expenses', function (Blueprint $table) {
            $table->index(['user_id', 'date', 'id'], 'expenses_pagination_idx');
        });

        // 2. Optimize Debts: (user_id, type, is_paid, id)
        // This covers filtering by type/is_paid and ordering by ID
        Schema::table('debts', function (Blueprint $table) {
            $table->index(['user_id', 'type', 'is_paid', 'id'], 'debts_pagination_idx');
        });

        // 3. Optimize Files: (user_id, id)
        Schema::table('files', function (Blueprint $table) {
            $table->index(['user_id', 'id'], 'files_pagination_idx');
        });

        // 4. Optimize Wallets: (user_id, id)
        Schema::table('wallets', function (Blueprint $table) {
            $table->index(['user_id', 'id'], 'wallets_pagination_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropIndex('expenses_pagination_idx');
        });

        Schema::table('debts', function (Blueprint $table) {
            $table->dropIndex('debts_pagination_idx');
        });

        Schema::table('files', function (Blueprint $table) {
            $table->dropIndex('files_pagination_idx');
        });

        Schema::table('wallets', function (Blueprint $table) {
            $table->dropIndex('wallets_pagination_idx');
        });
    }
};
