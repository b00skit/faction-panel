<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop in reverse dependency order
        Schema::dropIfExists('statistics_widgets');
        Schema::dropIfExists('statistics_permissions');
        Schema::dropIfExists('statistics_models');

        // Create statistics_models
        Schema::create('statistics_models', function (Blueprint $table) {
            $table->id();
            $table->foreignId('faction_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        // Create statistics_permissions
        Schema::create('statistics_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('statistics_model_id')->constrained()->cascadeOnDelete();
            $table->foreignId('group_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->nullable()->constrained()->cascadeOnDelete();
            $table->json('permissions')->nullable();
            $table->timestamps();
        });

        // Create statistics_widgets
        Schema::create('statistics_widgets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('statistics_model_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('type')->default('pie'); // 'pie', 'bar', 'line', 'table', 'stat', 'radar'
            $table->json('configuration')->nullable();
            $table->json('cache_result')->nullable();
            $table->timestamp('last_calculated_at')->nullable();
            $table->boolean('is_intensive')->default(false);
            $table->integer('order')->default(0);
            $table->integer('width')->default(6); // 1-12 grid
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('statistics_widgets');
        Schema::dropIfExists('statistics_permissions');
        Schema::dropIfExists('statistics_models');
    }
};
