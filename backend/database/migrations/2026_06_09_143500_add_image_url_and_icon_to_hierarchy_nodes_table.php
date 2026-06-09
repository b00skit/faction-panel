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
        Schema::table('hierarchy_nodes', function (Blueprint $table) {
            $table->string('image_url', 2048)->nullable()->after('card_style');
            $table->string('icon', 50)->nullable()->after('image_url');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('hierarchy_nodes', function (Blueprint $table) {
            $table->dropColumn(['image_url', 'icon']);
        });
    }
};
