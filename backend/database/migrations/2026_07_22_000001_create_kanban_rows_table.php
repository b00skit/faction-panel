<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('kanban_rows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('kanban_projects')->cascadeOnDelete();
            $table->string('name');
            $table->integer('order')->default(0);
            $table->boolean('is_visible')->default(true);
            $table->boolean('is_default')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::table('kanban_statuses', function (Blueprint $table) {
            $table->boolean('is_default')->default(false);
        });

        Schema::table('kanban_cards', function (Blueprint $table) {
            $table->foreignId('row_id')->nullable()->constrained('kanban_rows')->nullOnDelete();
        });

        // Set is_default = true on first status of existing projects, and seed default row for existing projects
        $projects = DB::table('kanban_projects')->get();
        foreach ($projects as $project) {
            // First status set default
            $firstStatus = DB::table('kanban_statuses')
                ->where('project_id', $project->id)
                ->orderBy('order')
                ->first();
            if ($firstStatus) {
                DB::table('kanban_statuses')->where('id', $firstStatus->id)->update(['is_default' => true]);
            }

            // Create default row if none exists
            $rowId = DB::table('kanban_rows')->insertGetId([
                'project_id' => $project->id,
                'name' => 'Default',
                'order' => 0,
                'is_visible' => true,
                'is_default' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Assign existing cards to default row
            DB::table('kanban_cards')->where('project_id', $project->id)->update(['row_id' => $rowId]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kanban_cards', function (Blueprint $table) {
            $table->dropForeign(['row_id']);
            $table->dropColumn('row_id');
        });

        Schema::table('kanban_statuses', function (Blueprint $table) {
            $table->dropColumn('is_default');
        });

        Schema::dropIfExists('kanban_rows');
    }
};
