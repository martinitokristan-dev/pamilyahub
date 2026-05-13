<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('salary_deposits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->decimal('amount', 15, 2);                         // total salary received
            $table->decimal('already_spent', 15, 2)->default(0);      // spent before depositing
            $table->unsignedTinyInteger('month');                     // 1-12
            $table->unsignedSmallInteger('year');
            $table->timestamp('deposited_at');                        // actual deposit timestamp
            $table->boolean('is_delayed')->default(false);            // deposited after day 10
            $table->text('notes')->nullable();
            $table->timestamps();

            // Unique per user per month/year (one primary salary per month)
            $table->index(['user_id', 'year', 'month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_deposits');
    }
};
