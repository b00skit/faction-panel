<?php

use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Services\GtawSyncService;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $syncService = app(GtawSyncService::class);

        Faction::whereNotNull('gtaw_faction_id')->chunkById(50, function ($factions) use ($syncService) {
            foreach ($factions as $faction) {
                $syncService->ensureGtawDatabases($faction);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        FactionRecordDatabase::whereIn('is_api_database', ['gtaw_vehicles', 'gtaw_vehicle_history'])->delete();
    }
};
