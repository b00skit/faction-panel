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
        Schema::create('kanban_projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('faction_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('color', 7)->default('#3b82f6');
            $table->integer('order')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('kanban_project_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('kanban_projects')->cascadeOnDelete();
            $table->foreignId('group_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->nullable()->constrained()->cascadeOnDelete();
            $table->json('permissions');
            $table->timestamps();
        });

        Schema::create('kanban_card_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('color', 7);
            $table->string('icon');
            $table->json('settings'); // e.g. { description, subtasks, color, icon, comments, assignee }
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('kanban_statuses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('kanban_projects')->cascadeOnDelete();
            $table->string('name');
            $table->integer('order')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('kanban_labels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('kanban_projects')->cascadeOnDelete();
            $table->string('name');
            $table->string('color', 7);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('kanban_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('kanban_projects')->cascadeOnDelete();
            $table->foreignId('status_id')->constrained('kanban_statuses')->cascadeOnDelete();
            $table->foreignId('card_type_id')->constrained('kanban_card_types')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('color', 7)->nullable();
            $table->integer('order')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('kanban_subtasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('card_id')->constrained('kanban_cards')->cascadeOnDelete();
            $table->string('title');
            $table->boolean('is_completed')->default(false);
            $table->integer('order')->default(0);
            $table->timestamps();
        });

        Schema::create('kanban_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('card_id')->constrained('kanban_cards')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('comment');
            $table->timestamps();
        });

        Schema::create('kanban_card_label', function (Blueprint $table) {
            $table->foreignId('card_id')->constrained('kanban_cards')->cascadeOnDelete();
            $table->foreignId('label_id')->constrained('kanban_labels')->cascadeOnDelete();
            $table->primary(['card_id', 'label_id']);
        });

        Schema::create('kanban_card_assignee', function (Blueprint $table) {
            $table->foreignId('card_id')->constrained('kanban_cards')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->primary(['card_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kanban_card_assignee');
        Schema::dropIfExists('kanban_card_label');
        Schema::dropIfExists('kanban_comments');
        Schema::dropIfExists('kanban_subtasks');
        Schema::dropIfExists('kanban_cards');
        Schema::dropIfExists('kanban_labels');
        Schema::dropIfExists('kanban_statuses');
        Schema::dropIfExists('kanban_card_types');
        Schema::dropIfExists('kanban_project_permissions');
        Schema::dropIfExists('kanban_projects');
    }
};
