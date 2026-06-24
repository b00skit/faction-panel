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
        Schema::create('faction_user_fields', function (Blueprint $table) {
            $table->id();
            $table->foreignId('faction_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('type'); // checkbox, text, textarea
            $table->boolean('is_featured')->default(false);
            $table->timestamps();
        });

        Schema::create('faction_user_field_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('faction_user_field_id')->constrained('faction_user_fields')->onDelete('cascade');
            $table->text('value')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'faction_user_field_id'], 'user_field_value_unique');
        });

        Schema::table('faction_invites', function (Blueprint $table) {
            $table->json('field_values')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('faction_invites', function (Blueprint $table) {
            $table->dropColumn('field_values');
        });

        Schema::dropIfExists('faction_user_field_values');
        Schema::dropIfExists('faction_user_fields');
    }
};
