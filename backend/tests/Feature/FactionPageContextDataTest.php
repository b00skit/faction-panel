<?php

namespace Tests\Feature;

use App\Models\Faction;
use App\Models\FactionPage;
use App\Models\FactionRecordDatabase;
use App\Models\FactionRecordEntry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FactionPageContextDataTest extends TestCase
{
    use RefreshDatabase;

    public function test_get_context_data_maps_entry_data_and_filters_involved_databases(): void
    {
        $user = User::factory()->create(['is_superadmin' => true]);
        $faction = Faction::factory()->create(['shortname' => 'lspd']);

        // Create two databases
        $vehDb = FactionRecordDatabase::create([
            'faction_id' => $faction->id,
            'name' => 'Faction Vehicles',
            'record_shortcode' => 'VEHICLES',
            'is_api_database' => 'gtaw_vehicles',
        ]);

        $otherDb = FactionRecordDatabase::create([
            'faction_id' => $faction->id,
            'name' => 'Unused Database',
            'record_shortcode' => 'UNUSED',
        ]);

        // Create entries
        FactionRecordEntry::create([
            'database_id' => $vehDb->id,
            'entry_id' => 1,
            'data' => [
                'id' => 101,
                'plate' => '101LSD',
                'model' => 'Vapid Stanier',
            ],
            'is_active' => true,
        ]);

        FactionRecordEntry::create([
            'database_id' => $otherDb->id,
            'entry_id' => 2,
            'data' => [
                'id' => 999,
                'item' => 'Secret Item',
            ],
            'is_active' => true,
        ]);

        // Create a page querying only vehicles
        $page = FactionPage::create([
            'faction_id' => $faction->id,
            'name' => 'Fleet Index',
            'slug' => 'fleet-index',
            'content' => '{{{json (getRecordEntries "gtaw_vehicles")}}}',
            'is_published' => true,
        ]);

        // Query context data specifying page=fleet-index
        $response = $this->actingAs($user)
            ->getJson("/api/factions/lspd/pages/context-data?page=fleet-index");

        $response->assertStatus(200);

        $data = $response->json();

        // 1. Verify records map contains entry_data and data under gtaw_vehicles, VEHICLES, Faction Vehicles
        $this->assertArrayHasKey('records', $data);
        $this->assertArrayHasKey('gtaw_vehicles', $data['records']);
        $this->assertCount(1, $data['records']['gtaw_vehicles']);
        $this->assertEquals('101LSD', $data['records']['gtaw_vehicles'][0]['data']['plate']);
        $this->assertEquals('101LSD', $data['records']['gtaw_vehicles'][0]['entry_data']['plate']);

        // 2. Verify that Unused Database entries are filtered out (empty entries array) because it was not queried in the page
        $this->assertArrayHasKey('UNUSED', $data['records']);
        $this->assertCount(0, $data['records']['UNUSED']);
    }
}
