<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_training_logs', function (Blueprint $table) {
            $table->id();
            $table->text('input_text');
            $table->string('translated_intent')->nullable();
            $table->json('translated_entities')->nullable();
            $table->string('provider')->nullable()->comment('gemini, groq, local');
            $table->boolean('local_missed')->default(false)->comment('True if local engine failed to catch this');
            $table->boolean('reviewed')->default(false)->comment('True when developer has processed this log');
            $table->string('keyword', 100)->nullable()->comment('Extracted unrecognized verb/keyword for UI grouping');
            $table->timestamps();

            $table->index('local_missed');
            $table->index('reviewed');
            $table->index('keyword');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_training_logs');
    }
};
