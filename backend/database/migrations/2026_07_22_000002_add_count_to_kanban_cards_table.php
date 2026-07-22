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
        Schema::table('kanban_cards', function (Blueprint $table) {
            $table->integer('count')->nullable()->after('row_id');
        });

        // Calculate and backfill count for all existing cards per project
        $projects = DB::table('kanban_projects')->get();
        foreach ($projects as $project) {
            $cards = DB::table('kanban_cards')
                ->where('project_id', $project->id)
                ->orderBy('id')
                ->get();

            $counter = 1;
            foreach ($cards as $card) {
                DB::table('kanban_cards')
                    ->where('id', $card->id)
                    ->update(['count' => $counter++]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kanban_cards', function (Blueprint $table) {
            $table->dropColumn('count');
        });
    }
};
