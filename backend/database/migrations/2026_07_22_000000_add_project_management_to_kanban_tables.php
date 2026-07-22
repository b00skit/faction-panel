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
            $table->boolean('enable_project_management')->default(false);
        });

        Schema::table('kanban_statuses', function (Blueprint $table) {
            $table->boolean('is_visible')->default(true);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kanban_projects', function (Blueprint $table) {
            $table->dropColumn('enable_project_management');
        });

        Schema::table('kanban_statuses', function (Blueprint $table) {
            $table->dropColumn('is_visible');
        });
    }
};
