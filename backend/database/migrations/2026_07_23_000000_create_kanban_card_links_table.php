<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kanban_card_links', function (Blueprint $table) {
            $table->foreignId('card_id')->constrained('kanban_cards')->cascadeOnDelete();
            $table->foreignId('linked_card_id')->constrained('kanban_cards')->cascadeOnDelete();
            $table->timestamps();

            $table->primary(['card_id', 'linked_card_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kanban_card_links');
    }
};
