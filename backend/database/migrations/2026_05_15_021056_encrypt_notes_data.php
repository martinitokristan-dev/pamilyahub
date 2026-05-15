<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Increase column sizes for encrypted data
        Schema::table('notes', function (Blueprint $table) {
            $table->text('title')->change();
            $table->longText('content')->change();
        });

        // 2. Encrypt existing data using DB facade to avoid Eloquent casts
        DB::table('notes')->orderBy('id')->chunk(100, function ($notes) {
            foreach ($notes as $note) {
                DB::table('notes')
                    ->where('id', $note->id)
                    ->update([
                        'title' => Crypt::encryptString($note->title),
                        'content' => Crypt::encryptString($note->content),
                    ]);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // 1. Decrypt existing data using DB facade
        DB::table('notes')->orderBy('id')->chunk(100, function ($notes) {
            foreach ($notes as $note) {
                // We use try-catch in case some data was not encrypted
                try {
                    $decryptedTitle = Crypt::decryptString($note->title);
                    $decryptedContent = Crypt::decryptString($note->content);

                    DB::table('notes')
                        ->where('id', $note->id)
                        ->update([
                            'title' => $decryptedTitle,
                            'content' => $decryptedContent,
                        ]);
                } catch (\Exception $e) {
                    // Ignore if already decrypted or invalid payload
                }
            }
        });

        // 2. Revert column sizes back to original (Note: truncates long text)
        Schema::table('notes', function (Blueprint $table) {
            $table->string('title', 255)->change();
            $table->text('content')->change();
        });
    }
};
