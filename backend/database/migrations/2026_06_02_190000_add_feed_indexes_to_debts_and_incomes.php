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
        Schema::table('debts', function (Blueprint $table) {
            $table->index(['user_id', 'created_at', 'id'], 'idx_debts_user_created_id');
        });

        Schema::table('debt_archives', function (Blueprint $table) {
            $table->index(['user_id', 'created_at', 'id'], 'idx_debt_archives_user_created_id');
        });

        Schema::table('incomes', function (Blueprint $table) {
            $table->index(['user_id', 'date', 'id'], 'idx_incomes_user_date_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('debts', function (Blueprint $table) {
            $table->dropIndex('idx_debts_user_created_id');
        });

        Schema::table('debt_archives', function (Blueprint $table) {
            $table->dropIndex('idx_debt_archives_user_created_id');
        });

        Schema::table('incomes', function (Blueprint $table) {
            $table->dropIndex('idx_incomes_user_date_id');
        });
    }
};
