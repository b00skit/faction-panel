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
        Schema::table('kanban_projects', function (Blueprint $table) {
            $table->string('prefix', 10)->nullable();
            $table->boolean('show_prefix')->default(true);
        });

        Schema::table('kanban_cards', function (Blueprint $table) {
            $table->boolean('is_archived')->default(false);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kanban_projects', function (Blueprint $table) {
            $table->dropColumn(['prefix', 'show_prefix']);
        });

        Schema::table('kanban_cards', function (Blueprint $table) {
            $table->dropColumn('is_archived');
        });
    }
};
