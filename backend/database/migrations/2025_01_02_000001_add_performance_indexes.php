<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            $table->index('user_id', 'notes_user_id_idx');
            $table->index(['user_id', 'created_at'], 'notes_user_created_idx');
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->index('user_id', 'expenses_user_id_idx');
            $table->index(['user_id', 'date'], 'expenses_user_date_idx');
            $table->index(['user_id', 'category'], 'expenses_user_category_idx');
        });

        Schema::table('debts', function (Blueprint $table) {
            $table->index('user_id', 'debts_user_id_idx');
            $table->index(['user_id', 'type', 'is_paid'], 'debts_user_type_paid_idx');
        });

        Schema::table('files', function (Blueprint $table) {
            $table->index('user_id', 'files_user_id_idx');
        });

        // FULLTEXT index for instant notes search
        try {
            DB::statement('ALTER TABLE notes ADD FULLTEXT INDEX notes_fulltext_idx (title, content)');
        } catch (\Throwable $e) {
            // Fallback: FULLTEXT not supported on this engine version
        }
    }

    public function down(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            $table->dropIndex('notes_user_id_idx');
            $table->dropIndex('notes_user_created_idx');
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->dropIndex('expenses_user_id_idx');
            $table->dropIndex('expenses_user_date_idx');
            $table->dropIndex('expenses_user_category_idx');
        });

        Schema::table('debts', function (Blueprint $table) {
            $table->dropIndex('debts_user_id_idx');
            $table->dropIndex('debts_user_type_paid_idx');
        });

        Schema::table('files', function (Blueprint $table) {
            $table->dropIndex('files_user_id_idx');
        });

        try {
            DB::statement('ALTER TABLE notes DROP INDEX notes_fulltext_idx');
        } catch (\Throwable $e) {
            //
        }
    }
};
