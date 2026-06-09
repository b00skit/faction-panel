<?php

use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Models\User;
use App\Services\GtawService;

beforeEach(function () {
    $this->leader = User::factory()->create([
        'gtaw_access_token' => 'mock-access-token',
        'gtaw_id' => 9999,
        'gtaw_username' => 'LeaderName',
    ]);

    $this->superadmin = User::factory()->create([
        'is_superadmin' => true,
    ]);

    $this->faction = Faction::create([
        'shortname' => 'lssd',
        'name' => 'Los Santos County Sheriff\'s Department',
        'color' => '#14571f',
        'visibility' => 'public',
        'access' => 'invite-only',
        'faction_leader' => $this->leader->id,
        'created_by' => $this->leader->id,
        'gtaw_faction_id' => 10,
    ]);

    $this->faction->users()->attach($this->leader->id);

    // Create Admin Role with permissions
    $this->adminRole = $this->faction->roles()->create([
        'name' => 'Administrator',
        'weight' => 100,
        'color' => '#ef4444',
        'type' => 'primary',
    ]);
    $this->leader->roles()->attach($this->adminRole->id);
    $this->adminRole->permissions()->create(['permission_key' => 'sync_gtaw', 'value' => 'YES']);
    $this->adminRole->permissions()->create(['permission_key' => 'global_faction_record_moderation', 'value' => 'YES']);

    // Set up CHARS database with the unique string value for is_api_database
    $this->charDb = FactionRecordDatabase::create([
        'faction_id' => $this->faction->id,
        'name' => 'Characters Database',
        'record_shortcode' => 'CHARS',
        'database_structure' => [
            ['id' => 'id', 'name' => 'ID', 'type' => 'number', 'required' => true],
            ['id' => 'name', 'name' => 'Character Name', 'type' => 'text', 'required' => true],
            ['id' => 'rank', 'name' => 'Rank', 'type' => 'text', 'required' => true],
            ['id' => 'abas', 'name' => 'ABAS', 'type' => 'text', 'required' => false],
            ['id' => 'total_abas', 'name' => 'Total ABAS', 'type' => 'text', 'required' => false],
            ['id' => 'user_id', 'name' => 'User ID', 'type' => 'number', 'required' => true],
            ['id' => 'char_id', 'name' => 'Character ID', 'type' => 'number', 'required' => true],
            ['id' => 'is_alt', 'name' => 'Alternative Character', 'type' => 'boolean', 'required' => true],
        ],
        'is_published' => true,
        'created_by' => $this->leader->id,
        'is_api_database' => 'gtaw_characters',
        'data_overview_display' => 'table',
        'data_entry_display' => 'card',
    ]);
});

test('syncing gtaw matches database even if record_shortcode is renamed by user (prefix rename safety)', function () {
    // 1. Rename the shortcode from CHARS to something else
    $this->charDb->update(['record_shortcode' => 'CHAR_OLD']);

    // 2. Mock GtawService to return members
    $this->mock(GtawService::class, function ($mock) {
        $mock->shouldReceive('getFactionMembers')->andReturn([
            'data' => [
                'members' => [
                    [
                        'character_id' => 12345,
                        'character_name' => 'John Doe',
                        'rank_name' => 'Sheriff',
                        'rank' => 15,
                        'abas' => 0.00,
                        'user_id' => 789,
                    ],
                ],
            ],
        ]);
        $mock->shouldReceive('getFactionAbas')->andReturn(['data' => []]);
    });

    // 3. Trigger sync
    $response = $this->actingAs($this->leader)->postJson('/api/factions/lssd/integrations/gtaw/sync');
    $response->assertStatus(200);

    // 4. Verify that no new CHARS database was created
    $databases = FactionRecordDatabase::where('faction_id', $this->faction->id)->get();

    // We expect 4 databases created/maintained in total (CHARS, ACTIVITY, CHIST, CNAME)
    // There shouldn't be any duplicate Characters Database
    $charsDbs = $databases->filter(function ($db) {
        return $db->getRawOriginal('is_api_database') === 'gtaw_characters';
    });

    expect($charsDbs->count())->toBe(1);
    expect($charsDbs->first()->record_shortcode)->toBe('CHAR_OLD');
});

test('only superadmins can edit API-managed databases', function () {
    // Attempt edit as non-superadmin (leader has global record moderation)
    $response = $this->actingAs($this->leader)->putJson("/api/factions/lssd/records/{$this->charDb->id}", [
        'name' => 'New Name',
        'record_shortcode' => 'NEW_CODE',
    ]);
    $response->assertStatus(403);
    $response->assertJsonPath('message', 'Only superadmins can edit API-managed databases.');

    // Attempt edit as superadmin
    $response2 = $this->actingAs($this->superadmin)->putJson("/api/factions/lssd/records/{$this->charDb->id}", [
        'name' => 'Superadmin Renamed',
        'record_shortcode' => 'SADMIN',
        'allow_details_view' => true,
        'data_overview_display' => 'table',
        'data_entry_display' => 'card',
    ]);
    $response2->assertStatus(200);

    $updatedDb = FactionRecordDatabase::find($this->charDb->id);
    expect($updatedDb->name)->toBe('Superadmin Renamed');
    expect($updatedDb->record_shortcode)->toBe('SADMIN');
});

test('only superadmins can delete API-managed databases', function () {
    // Attempt delete as non-superadmin
    $response = $this->actingAs($this->leader)->deleteJson("/api/factions/lssd/records/{$this->charDb->id}");
    $response->assertStatus(403);
    $response->assertJsonPath('message', 'Only superadmins can delete API-managed databases.');

    // Attempt delete as superadmin
    $response2 = $this->actingAs($this->superadmin)->deleteJson("/api/factions/lssd/records/{$this->charDb->id}");
    $response2->assertStatus(204);

    $deletedDb = FactionRecordDatabase::withTrashed()->find($this->charDb->id);
    expect($deletedDb->trashed())->toBeTrue();
});
