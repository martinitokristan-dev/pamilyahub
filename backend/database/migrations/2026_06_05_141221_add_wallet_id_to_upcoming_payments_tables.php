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
        Schema::table('upcoming_payments', function (Blueprint $table) {
            $table->foreignId('wallet_id')->nullable()->after('paid_date')->constrained()->nullOnDelete();
        });

        if (Schema::hasTable('upcoming_payment_archives')) {
            Schema::table('upcoming_payment_archives', function (Blueprint $table) {
                $table->foreignId('wallet_id')->nullable()->after('paid_date')->constrained()->nullOnDelete();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('upcoming_payments', function (Blueprint $table) {
            $table->dropForeign(['wallet_id']);
            $table->dropColumn('wallet_id');
        });

        if (Schema::hasTable('upcoming_payment_archives')) {
            Schema::table('upcoming_payment_archives', function (Blueprint $table) {
                $table->dropForeign(['wallet_id']);
                $table->dropColumn('wallet_id');
            });
        }
    }
};
