<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // STEP 1: Change columns to MEDIUMTEXT for encryption
        // TiDB specific: MEDIUMTEXT for large fields, prefix indexes if needed.
        
        // 1. expenses
        Schema::table('expenses', function (Blueprint $table) {
            $table->mediumText('amount')->change();
            $table->mediumText('title')->change();
            $table->mediumText('description')->nullable()->change();
        });

        // 2. wallets
        Schema::table('wallets', function (Blueprint $table) {
            $table->mediumText('balance')->change();
        });

        // 3. users
        Schema::table('users', function (Blueprint $table) {
            $table->mediumText('monthly_salary')->nullable()->change();
        });

        // 4. debts
        Schema::table('debts', function (Blueprint $table) {
            $table->mediumText('amount')->change();
            $table->mediumText('description')->nullable()->change();
        });

        // 5. notes
        Schema::table('notes', function (Blueprint $table) {
            $table->mediumText('title')->change();
            $table->mediumText('content')->change(); // content was already text, but making sure it's MEDIUMTEXT
        });

        // 6. incomes
        Schema::table('incomes', function (Blueprint $table) {
            $table->mediumText('amount')->change();
        });

        // 7. salary_deposits
        Schema::table('salary_deposits', function (Blueprint $table) {
            $table->mediumText('amount')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reverting to original types (approximation since some were decimal, some string)
        
        Schema::table('expenses', function (Blueprint $table) {
            $table->decimal('amount', 14, 2)->change();
            $table->string('title')->change();
            $table->string('description')->nullable()->change();
        });

        Schema::table('wallets', function (Blueprint $table) {
            $table->decimal('balance', 14, 2)->change();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->decimal('monthly_salary', 14, 2)->nullable()->change();
        });

        Schema::table('debts', function (Blueprint $table) {
            $table->decimal('amount', 14, 2)->change();
            $table->string('description')->nullable()->change();
        });

        Schema::table('notes', function (Blueprint $table) {
            $table->string('title')->change();
            $table->text('content')->change();
        });

        Schema::table('incomes', function (Blueprint $table) {
            $table->decimal('amount', 14, 2)->change();
        });

        Schema::table('salary_deposits', function (Blueprint $table) {
            $table->decimal('amount', 14, 2)->change();
        });
    }
};
