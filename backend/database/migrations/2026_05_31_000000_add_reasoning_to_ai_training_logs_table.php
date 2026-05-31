<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_training_logs', function (Blueprint $table) {
            $table->text('reasoning')->nullable()->after('translated_entities');
        });
    }

    public function down(): void
    {
        Schema::table('ai_training_logs', function (Blueprint $table) {
            $table->dropColumn('reasoning');
        });
    }
};
