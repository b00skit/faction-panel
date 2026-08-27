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

    public function test_get_context_data_strictly_restricts_to_allowed_databases_configured_on_page(): void
    {
        $user = User::factory()->create(['is_superadmin' => true]);
        $faction = Faction::factory()->create(['shortname' => 'lspd']);

        $vehDb = FactionRecordDatabase::create([
            'faction_id' => $faction->id,
            'name' => 'Faction Vehicles',
            'record_shortcode' => 'VEHICLES',
            'is_api_database' => 'gtaw_vehicles',
        ]);

        $sensitiveDb = FactionRecordDatabase::create([
            'faction_id' => $faction->id,
            'name' => 'Internal Affairs Investigations',
            'record_shortcode' => 'IA_LOGS',
        ]);

        FactionRecordEntry::create([
            'database_id' => $vehDb->id,
            'entry_id' => 1,
            'data' => ['plate' => '101LSD', 'model' => 'Stanier'],
            'is_active' => true,
        ]);

        FactionRecordEntry::create([
            'database_id' => $sensitiveDb->id,
            'entry_id' => 1,
            'data' => ['target' => 'Officer Undercover', 'details' => 'Top Secret Case'],
            'is_active' => true,
        ]);

        // Create page with allowed_databases set ONLY to the vehicles database ID
        $page = FactionPage::create([
            'faction_id' => $faction->id,
            'name' => 'Restricted Fleet Registry',
            'slug' => 'fleet-registry',
            // Content contains numbers and words that might resemble other database IDs or fields
            'content' => '<div class="col-1 grid-2 p-3">Fleet category 2</div>',
            'allowed_databases' => [$vehDb->id],
            'is_published' => true,
        ]);

        $response = $this->actingAs($user)
            ->getJson("/api/factions/lspd/pages/context-data?page=fleet-registry");

        $response->assertStatus(200);
        $data = $response->json();

        // 1. Vehicle DB is included and entries are populated
        $this->assertArrayHasKey('records', $data);
        $this->assertArrayHasKey('gtaw_vehicles', $data['records']);
        $this->assertCount(1, $data['records']['gtaw_vehicles']);

        // 2. Sensitive DB is completely excluded from record_databases and records
        $this->assertArrayNotHasKey('IA_LOGS', $data['records']);
        $this->assertArrayNotHasKey('Internal Affairs Investigations', $data['records']);
        $this->assertCount(1, $data['record_databases']);
        $this->assertEquals($vehDb->id, $data['record_databases'][0]['id']);
    }

    public function test_numbers_in_template_do_not_leak_unreferenced_databases(): void
    {
        $user = User::factory()->create(['is_superadmin' => true]);
        $faction = Faction::factory()->create(['shortname' => 'lspd']);

        $db1 = FactionRecordDatabase::create([
            'faction_id' => $faction->id,
            'name' => 'Database Alpha',
            'record_shortcode' => 'ALPHA',
        ]);

        $db2 = FactionRecordDatabase::create([
            'faction_id' => $faction->id,
            'name' => 'Database Beta',
            'record_shortcode' => 'BETA',
        ]);

        FactionRecordEntry::create([
            'database_id' => $db1->id,
            'entry_id' => 1,
            'data' => ['secret' => 'alpha secret'],
            'is_active' => true,
        ]);

        FactionRecordEntry::create([
            'database_id' => $db2->id,
            'entry_id' => 2,
            'data' => ['secret' => 'beta secret'],
            'is_active' => true,
        ]);

        // Template has plain numbers '1' and '2', but references only ALPHA
        $page = FactionPage::create([
            'faction_id' => $faction->id,
            'name' => 'Alpha Page',
            'slug' => 'alpha-page',
            'content' => '<div>Division 1, Category 2, Step 3. {{#each (getRecordEntries "ALPHA")}}{{/each}}</div>',
            'is_published' => true,
        ]);

        $response = $this->actingAs($user)
            ->getJson("/api/factions/lspd/pages/context-data?page=alpha-page");

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertCount(1, $data['records']['ALPHA']);
        // Database Beta should NOT have its entries loaded merely because '2' was in the HTML text
        $this->assertCount(0, $data['records']['BETA']);
    }
}
