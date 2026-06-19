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
        Schema::dropIfExists('hierarchy_roster');
        
        Schema::create('hierarchy_roster', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hierarchy_id')->constrained()->cascadeOnDelete();
            $table->foreignId('roster_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
        });

        // Copy existing relationships from hierarchies table
        $hierarchies = DB::table('hierarchies')->whereNotNull('roster_id')->get();
        foreach ($hierarchies as $hierarchy) {
            DB::table('hierarchy_roster')->insert([
                'hierarchy_id' => $hierarchy->id,
                'roster_id' => $hierarchy->roster_id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Drop roster_id constraint and column
        Schema::table('hierarchies', function (Blueprint $table) {
            $table->dropForeign(['roster_id']);
            $table->dropColumn('roster_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('hierarchies', function (Blueprint $table) {
            $table->foreignId('roster_id')->nullable()->constrained()->nullOnDelete();
        });

        // Copy back first linked roster
        $links = DB::table('hierarchy_roster')->orderBy('id')->get()->groupBy('hierarchy_id');
        foreach ($links as $hierarchyId => $group) {
            DB::table('hierarchies')
                ->where('id', $hierarchyId)
                ->update(['roster_id' => $group->first()->roster_id]);
        }

        Schema::dropIfExists('hierarchy_roster');
    }
};
