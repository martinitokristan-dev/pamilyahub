<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('upcoming_payments', function (Blueprint $table) {
            $table->string('recurrence', 20)->nullable()->after('category');
        });

        if (Schema::hasTable('upcoming_payment_archives')) {
            Schema::table('upcoming_payment_archives', function (Blueprint $table) {
                if (!Schema::hasColumn('upcoming_payment_archives', 'recurrence')) {
                    $table->string('recurrence', 20)->nullable()->after('category');
                }
            });
        }
    }

    public function down(): void
    {
        Schema::table('upcoming_payments', function (Blueprint $table) {
            $table->dropColumn('recurrence');
        });

        if (Schema::hasTable('upcoming_payment_archives')) {
            Schema::table('upcoming_payment_archives', function (Blueprint $table) {
                if (Schema::hasColumn('upcoming_payment_archives', 'recurrence')) {
                    $table->dropColumn('recurrence');
                }
            });
        }
    }
};
