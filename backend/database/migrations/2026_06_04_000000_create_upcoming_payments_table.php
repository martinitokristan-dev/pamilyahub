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
        Schema::create('upcoming_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->mediumText('title'); // Encrypted
            $table->mediumText('amount'); // Encrypted
            $table->mediumText('description')->nullable(); // Encrypted
            $table->date('due_date');
            $table->boolean('is_paid')->default(false);
            $table->date('paid_date')->nullable();
            $table->string('category', 100)->nullable();
            $table->timestamps();

            // Indexes for retrieval performance
            $table->index(['user_id', 'is_paid', 'due_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('upcoming_payments');
    }
};
