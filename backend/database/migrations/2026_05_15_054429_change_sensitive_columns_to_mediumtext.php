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
        Schema::table('user_stats', function (Blueprint $table) {
            $table->mediumText('expenses_total')->change();
            $table->mediumText('debts_owed_to_me')->change();
            $table->mediumText('debts_i_owe')->change();
            $table->mediumText('income_total')->change();
        });

        Schema::table('salary_deposits', function (Blueprint $table) {
            $table->mediumText('already_spent')->change();
        });

        Schema::table('incomes', function (Blueprint $table) {
            $table->mediumText('source')->change();
            $table->mediumText('description')->change();
        });

        Schema::table('debts', function (Blueprint $table) {
            $table->mediumText('name')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_stats', function (Blueprint $table) {
            $table->decimal('expenses_total', 14, 2)->change();
            $table->decimal('debts_owed_to_me', 14, 2)->change();
            $table->decimal('debts_i_owe', 14, 2)->change();
            $table->decimal('income_total', 15, 2)->change();
        });

        Schema::table('salary_deposits', function (Blueprint $table) {
            $table->decimal('already_spent', 8, 2)->change();
        });

        Schema::table('incomes', function (Blueprint $table) {
            $table->string('source')->change();
            $table->text('description')->nullable()->change();
        });

        Schema::table('debts', function (Blueprint $table) {
            $table->string('name')->change();
        });
    }
};
