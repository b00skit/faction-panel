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
        Schema::create('hierarchies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('faction_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('color', 7);
            $table->integer('order')->default(0);
            $table->foreignId('roster_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('hierarchy_nodes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hierarchy_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('hierarchy_nodes')->cascadeOnDelete();
            $table->string('title')->nullable();
            $table->string('color', 7)->nullable();
            $table->json('slots')->nullable(); // Array of slot objects: [{ id, roster_content_id, label, value, color }]
            $table->integer('order')->default(0);
            $table->timestamps();
        });

        Schema::create('hierarchy_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hierarchy_id')->constrained()->cascadeOnDelete();
            $table->foreignId('group_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->nullable()->constrained()->cascadeOnDelete();
            $table->json('permissions');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('hierarchy_permissions');
        Schema::dropIfExists('hierarchy_nodes');
        Schema::dropIfExists('hierarchies');
    }
};
