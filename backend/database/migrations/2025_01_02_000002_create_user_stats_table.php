<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_stats', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->primary();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->unsignedInteger('notes_count')->default(0);
            $table->decimal('expenses_total', 14, 2)->default(0);
            $table->decimal('debts_owed_to_me', 14, 2)->default(0);
            $table->decimal('debts_i_owe', 14, 2)->default(0);
            $table->unsignedInteger('files_count')->default(0);
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_stats');
    }
};
