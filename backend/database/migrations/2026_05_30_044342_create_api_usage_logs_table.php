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
        Schema::create('api_usage_logs', function (Blueprint $table) {
            $table->id();
            $table->string('provider');
            $table->string('key_prefix');
            $table->string('endpoint');
            $table->integer('status_code');
            $table->integer('response_time_ms')->nullable();
            $table->integer('tokens_used')->nullable();
            $table->timestamps();

            $table->index(['provider', 'key_prefix', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('api_usage_logs');
    }
};
