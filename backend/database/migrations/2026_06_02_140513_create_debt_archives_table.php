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
        Schema::create('debt_archives', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id');
            $table->mediumText('name');
            $table->mediumText('amount');
            $table->enum('type', ['owed_to_me', 'i_owe']);
            $table->mediumText('description')->nullable();
            $table->date('due_date')->nullable();
            $table->boolean('is_paid')->default(false);
            $table->timestamps();
            $table->timestamp('archived_at')->useCurrent();

            $table->index('user_id');
            $table->index('due_date');
            $table->index('type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('debt_archives');
    }
};
