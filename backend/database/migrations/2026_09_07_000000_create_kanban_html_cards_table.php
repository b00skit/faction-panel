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
        Schema::create('kanban_html_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('kanban_projects')->cascadeOnDelete();
            $table->foreignId('status_id')->constrained('kanban_statuses')->cascadeOnDelete();
            $table->string('name');
            $table->longText('content')->nullable();
            $table->string('position')->default('top'); // 'top' or 'bottom'
            $table->integer('order')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kanban_html_cards');
    }
};
