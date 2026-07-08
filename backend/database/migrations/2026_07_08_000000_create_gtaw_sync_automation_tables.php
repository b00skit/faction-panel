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
        Schema::create('gtaw_sync_automations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('faction_id')->unique()->constrained('factions')->onDelete('cascade');
            $table->boolean('enabled')->default(false);
            $table->string('frequency'); // 'daily', 'twice_daily', 'every_8_hours', 'every_6_hours', 'every_4_hours', 'every_2_hours', 'hourly'
            $table->string('time_of_day')->default('00:00'); // 'HH:MM'
            $table->timestamp('next_run_at')->nullable();
            $table->timestamp('last_run_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
        });

        Schema::create('gtaw_sync_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('faction_id')->constrained('factions')->onDelete('cascade');
            $table->string('trigger_type'); // 'manual', 'automated'
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->string('status'); // 'success', 'failed'
            $table->json('results')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('gtaw_sync_logs');
        Schema::dropIfExists('gtaw_sync_automations');
    }
};
