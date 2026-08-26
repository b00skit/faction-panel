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
        Schema::table('roster_contents', function (Blueprint $table) {
            $table->json('linked_id')->nullable()->after('content');
            $table->json('linked_display')->nullable()->after('linked_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('roster_contents', function (Blueprint $table) {
            $table->dropColumn(['linked_id', 'linked_display']);
        });
    }
};
