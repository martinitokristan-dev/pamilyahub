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
        Schema::create('income_archives', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('wallet_id')->nullable()->constrained()->onDelete('set null');
            $table->string('source')->default('Salary');
            $table->mediumText('amount'); // using mediumText for EncryptedValue compatibility
            $table->date('date');
            $table->mediumText('description')->nullable();
            $table->timestamps();
            
            // Add archive-specific column
            $table->timestamp('archived_at')->nullable();

            // Cursor pagination index
            $table->index(['user_id', 'date', 'id'], 'idx_income_archives_user_date_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('income_archives');
    }
};
