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
        Schema::table('factions', function (Blueprint $table) {
            $table->string('header_image_light')->nullable()->after('header_image');
            $table->renameColumn('header_image', 'header_image_dark');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('factions', function (Blueprint $table) {
            $table->renameColumn('header_image_dark', 'header_image');
            $table->dropColumn('header_image_light');
        });
    }
};
