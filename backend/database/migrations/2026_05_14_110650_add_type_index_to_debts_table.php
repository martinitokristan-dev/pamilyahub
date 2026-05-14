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
            $table->index(['user_id', 'type']);
            $table->index(['user_id', 'is_paid']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('debts', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'type']);
            $table->dropIndex(['user_id', 'is_paid']);
        });
    }
};
