<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expenses', function (Blueprint $blueprint) {
            // TiDB requires dropping the index before the column
            if (Schema::hasColumn('expenses', 'category')) {
                $blueprint->dropIndex('expenses_user_category_idx');
                $blueprint->dropColumn('category');
            }
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $blueprint) {
            $blueprint->string('category', 100)->nullable();
        });
    }
};
