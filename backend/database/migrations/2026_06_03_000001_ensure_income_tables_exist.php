<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('incomes')) {
            Schema::create('incomes', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->unsignedBigInteger('wallet_id')->nullable();
                $table->mediumText('source');
                $table->mediumText('amount');
                $table->date('date');
                $table->mediumText('description')->nullable();
                $table->timestamps();

                $table->index(['user_id', 'date', 'id'], 'incomes_user_date_id_idx');
            });
        }

        if (! Schema::hasTable('income_archives')) {
            Schema::create('income_archives', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->unsignedBigInteger('wallet_id')->nullable();
                $table->mediumText('source');
                $table->mediumText('amount');
                $table->date('date');
                $table->mediumText('description')->nullable();
                $table->timestamps();
                $table->timestamp('archived_at')->nullable();

                $table->index(['user_id', 'date', 'id'], 'income_archives_user_date_id_idx');
            });
        }
    }

    public function down(): void
    {
        // Intentionally no-op: tables may have existed before this repair migration.
    }
};
