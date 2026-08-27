<?php

namespace Tests\Feature;

use App\Models\Faction;
use App\Models\FactionPage;
use App\Models\FactionRecordDatabase;
use App\Models\FactionRecordEntry;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FactionPublicPagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_list_and_view_public_page_and_receives_injected_records(): void
    {
        $faction = Faction::factory()->create(['shortname' => 'lscso', 'name' => 'Los Santos County Sheriff']);

        // Create a public database with Everyone / Public view permissions
        $db = FactionRecordDatabase::create([
            'faction_id' => $faction->id,
            'name' => 'Patrol Vehicles',
            'record_shortcode' => 'VEH',
            'is_published' => true,
        ]);
        $db->databasePermissions()->create([
            'role_id' => null,
            'group_id' => null,
            'permissions' => ['view_database'],
        ]);

        FactionRecordEntry::create([
            'database_id' => $db->id,
            'entry_id' => 1,
            'data' => [
                'callsign' => '101A',
                'model' => 'Scout',
            ],
            'is_active' => true,
        ]);

        // Create a public page
        $page = FactionPage::create([
            'faction_id' => $faction->id,
            'name' => 'Public Fleet Overview',
            'slug' => 'fleet-overview',
            'content' => '<div>Fleet: {{#each (getRecordEntries "VEH")}}{{callsign}} - {{model}}{{/each}}</div>',
            'is_published' => true,
        ]);
        $page->permissions()->create([
            'role_id' => null,
            'group_id' => null,
            'permissions' => ['view_page'],
        ]);

        // 1. Guest lists pages
        $listRes = $this->getJson('/api/factions/lscso/pages');
        $listRes->assertStatus(200);
        $pages = $listRes->json();
        $this->assertCount(1, $pages);
        $this->assertEquals('Public Fleet Overview', $pages[0]['name']);

        // 2. Guest views single page
        $showRes = $this->getJson('/api/factions/lscso/pages/fleet-overview');
        $showRes->assertStatus(200);
        $this->assertEquals('Public Fleet Overview', $showRes->json('name'));

        // 3. Guest fetches context data with record injection
        $ctxRes = $this->getJson('/api/factions/lscso/pages/context-data?page=fleet-overview');
        $ctxRes->assertStatus(200);
        $ctxData = $ctxRes->json();

        $this->assertArrayHasKey('records', $ctxData);
        $this->assertArrayHasKey('VEH', $ctxData['records']);
        $this->assertCount(1, $ctxData['records']['VEH']);
        $this->assertEquals('101A', $ctxData['records']['VEH'][0]['data']['callsign']);
    }

    public function test_guest_cannot_view_private_page(): void
    {
        $faction = Faction::factory()->create(['shortname' => 'lscso']);

        $role = Role::create([
            'faction_id' => $faction->id,
            'name' => 'Command Staff',
            'weight' => 50,
            'color' => '#ffffff',
            'type' => 'primary',
        ]);

        // Create page restricted only to Command Staff
        $privatePage = FactionPage::create([
            'faction_id' => $faction->id,
            'name' => 'Restricted Briefing',
            'slug' => 'restricted-briefing',
            'content' => '<div>Secret Info</div>',
            'is_published' => true,
        ]);
        $privatePage->permissions()->create([
            'role_id' => $role->id,
            'group_id' => null,
            'permissions' => ['view_page'],
        ]);

        // 1. Guest list should be empty
        $listRes = $this->getJson('/api/factions/lscso/pages');
        $listRes->assertStatus(200);
        $this->assertCount(0, $listRes->json());

        // 2. Guest show should be forbidden
        $showRes = $this->getJson('/api/factions/lscso/pages/restricted-briefing');
        $showRes->assertStatus(403);

        // 3. Guest context data should be forbidden
        $ctxRes = $this->getJson('/api/factions/lscso/pages/context-data?page=restricted-briefing');
        $ctxRes->assertStatus(403);
    }

    public function test_non_faction_user_can_view_public_page_and_injected_records(): void
    {
        $faction = Faction::factory()->create(['shortname' => 'lscso']);
        $externalUser = User::factory()->create();

        $page = FactionPage::create([
            'faction_id' => $faction->id,
            'name' => 'Public Press Release',
            'slug' => 'press-release',
            'content' => '<div>Welcome external visitor</div>',
            'is_published' => true,
        ]);
        $page->permissions()->create([
            'role_id' => null,
            'group_id' => null,
            'permissions' => ['view_page'],
        ]);

        $response = $this->actingAs($externalUser)
            ->getJson('/api/factions/lscso/pages/press-release');

        $response->assertStatus(200);
        $this->assertEquals('Public Press Release', $response->json('name'));
    }

    public function test_public_page_with_allowed_databases_injects_records_for_guest(): void
    {
        $faction = Faction::factory()->create(['shortname' => 'lspd']);

        // Database without explicit public permissions
        $db = FactionRecordDatabase::create([
            'faction_id' => $faction->id,
            'name' => 'Equipment Registry',
            'record_shortcode' => 'EQUIP',
            'is_published' => true,
        ]);

        FactionRecordEntry::create([
            'database_id' => $db->id,
            'entry_id' => 1,
            'data' => [
                'serial' => 'SN-9988',
                'name' => 'Bodycam Gen 4',
            ],
            'is_active' => true,
        ]);

        // Public page that explicitly specifies $db->id in allowed_databases
        $page = FactionPage::create([
            'faction_id' => $faction->id,
            'name' => 'Public Equipment Spec',
            'slug' => 'equipment-spec',
            'content' => '<div>Equipment count: {{#each (getRecordEntries "EQUIP")}}{{serial}}{{/each}}</div>',
            'allowed_databases' => [$db->id],
            'is_published' => true,
        ]);
        $page->permissions()->create([
            'role_id' => null,
            'group_id' => null,
            'permissions' => ['view_page'],
        ]);

        $ctxRes = $this->getJson('/api/factions/lspd/pages/context-data?page=equipment-spec');
        $ctxRes->assertStatus(200);
        $data = $ctxRes->json();

        $this->assertArrayHasKey('records', $data);
        $this->assertArrayHasKey('EQUIP', $data['records']);
        $this->assertCount(1, $data['records']['EQUIP']);
        $this->assertEquals('SN-9988', $data['records']['EQUIP'][0]['data']['serial']);
    }

    public function test_faction_show_does_not_403_for_guest_when_public_pages_exist_without_public_rosters(): void
    {
        $faction = Faction::factory()->create(['shortname' => 'lspd']);

        $page = FactionPage::create([
            'faction_id' => $faction->id,
            'name' => 'Community Outreach',
            'slug' => 'community',
            'is_published' => true,
        ]);
        $page->permissions()->create([
            'role_id' => null,
            'group_id' => null,
            'permissions' => ['view_page'],
        ]);

        $response = $this->getJson('/api/factions/lspd');
        $response->assertStatus(200);

        $data = $response->json();
        $this->assertArrayHasKey('faction_pages', $data);
        $this->assertCount(1, $data['faction_pages']);
        $this->assertEquals('Community Outreach', $data['faction_pages'][0]['name']);
    }
}
