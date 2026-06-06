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
        Schema::create('expense_archives', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id');
            $table->foreignId('wallet_id')->nullable();
            $table->mediumText('title');
            $table->mediumText('amount');
            $table->mediumText('description')->nullable();
            $table->date('date');
            $table->string('payment_method', 50)->nullable();
            $table->boolean('is_settled')->default(false);
            $table->decimal('settled_amount', 10, 2)->default(0);
            $table->timestamps();
            $table->timestamp('archived_at')->useCurrent();

            $table->index('user_id');
            $table->index('date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('expense_archives');
    }
};
