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
        Schema::create('kanban_priorities', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('color', 7)->default('#3b82f6');
            $table->string('icon')->default('ArrowUp');
            $table->integer('order')->default(0);
            $table->boolean('is_default')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::table('kanban_cards', function (Blueprint $table) {
            $table->foreignId('priority_id')->nullable()->after('card_type_id')->constrained('kanban_priorities')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kanban_cards', function (Blueprint $table) {
            $table->dropForeign(['priority_id']);
            $table->dropColumn('priority_id');
        });

        Schema::dropIfExists('kanban_priorities');
    }
};
