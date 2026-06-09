<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('faction_record_databases', function (Blueprint $table) {
            $table->renameColumn('is_api_database', 'is_api_database_old');
        });

        Schema::table('faction_record_databases', function (Blueprint $table) {
            $table->string('is_api_database')->default('0')->nullable();
        });

        // Copy data
        DB::table('faction_record_databases')->chunkById(100, function ($databases) {
            foreach ($databases as $db) {
                $oldVal = $db->is_api_database_old;
                $newVal = $oldVal ? '1' : '0';
                DB::table('faction_record_databases')
                    ->where('id', $db->id)
                    ->update(['is_api_database' => $newVal]);
            }
        });

        Schema::table('faction_record_databases', function (Blueprint $table) {
            $table->dropColumn('is_api_database_old');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('faction_record_databases', function (Blueprint $table) {
            $table->renameColumn('is_api_database', 'is_api_database_old');
        });

        Schema::table('faction_record_databases', function (Blueprint $table) {
            $table->boolean('is_api_database')->default(false);
        });

        DB::table('faction_record_databases')->chunkById(100, function ($databases) {
            foreach ($databases as $db) {
                $oldVal = $db->is_api_database_old;
                $newVal = ($oldVal && $oldVal !== '0' && $oldVal !== 'false') ? true : false;
                DB::table('faction_record_databases')
                    ->where('id', $db->id)
                    ->update(['is_api_database' => $newVal]);
            }
        });

        Schema::table('faction_record_databases', function (Blueprint $table) {
            $table->dropColumn('is_api_database_old');
        });
    }
};
