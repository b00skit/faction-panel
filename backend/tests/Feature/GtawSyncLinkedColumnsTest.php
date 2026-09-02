<?php

use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Models\Roster;
use App\Models\RosterContent;
use App\Models\User;
use App\Services\GtawService;

beforeEach(function () {
    $this->leader = User::factory()->create([
        'gtaw_access_token' => 'mock-access-token',
        'gtaw_id' => 9999,
        'gtaw_username' => 'LeaderName',
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

    // Create Admin Role with sync_gtaw permission
    $this->adminRole = $this->faction->roles()->create([
        'name' => 'Administrator',
        'weight' => 100,
        'color' => '#ef4444',
        'type' => 'primary',
    ]);
    $this->leader->roles()->attach($this->adminRole->id);
    $this->adminRole->permissions()->create(['permission_key' => 'sync_gtaw', 'value' => 'YES']);

    // Set up CHARS database (mocking ensureGtawDatabases)
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
        'data_overview_display' => 'table',
        'data_entry_display' => 'card',
    ]);

    // Create a dataset for CHARS
    $this->dataset = $this->faction->rosterDatasets()->create([
        'name' => 'Personnel DB',
        'type' => 'record_database',
        'record_database_id' => $this->charDb->id,
        'created_by' => $this->leader->id,
    ]);

    // Create a roster with name column linked to this dataset
    $this->roster = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'Main Roster',
        'shortname' => 'MAIN',
        'color' => '#14571f',
        'order' => 0,
        'columns' => [
            [
                'id' => 'name',
                'name' => 'Name',
                'type' => 'dropdown',
                'dataset_id' => $this->dataset->id,
                'database_field_id' => 'name',
                'checkboxes' => [
                    [
                        'label' => 'Acting Officer',
                        'color' => '#ef4444',
                        'auto_apply' => [
                            'db_column' => 'rank_id',
                            'match_value' => '15',
                        ],
                    ],
                ],
                'tags' => [
                    [
                        'label' => 'Command',
                        'color' => '#3b82f6',
                        'auto_apply' => [
                            'db_column' => 'rank_id',
                            'match_value' => '15',
                        ],
                    ],
                ],
            ],
        ],
        'created_by' => $this->leader->id,
    ]);

    $this->section = $this->roster->sections()->create([
        'name' => 'HQ',
        'shortname' => 'HQ',
        'type' => 'master',
        'order' => 0,
        'created_by' => $this->leader->id,
    ]);

    // Roster content row - string value "John Doe" (initially unlinked / missing)
    $this->contentRow = $this->section->contents()->create([
        'type' => 'predefined',
        'content' => [
            'name' => 'John Doe',
            'name_cb' => [],
            'name_tags' => [],
        ],
        'created_by' => $this->leader->id,
    ]);
});

test('syncing gtaw correctly updates linked roster column values and auto-applies checkboxes/tags', function () {
    // 1. Mock GtawService to return John Doe as a member
    $this->mock(GtawService::class, function ($mock) {
        $mock->shouldReceive('getFactionMembers')->andReturn([
            'data' => [
                'members' => [
                    [
                        'character_id' => 12345,
                        'character_name' => 'John Doe',
                        'rank_name' => 'Acting Sheriff',
                        'rank' => 15,
                        'abas' => 0.00,
                        'user_id' => 789,
                    ],
                ],
            ],
        ]);

        $mock->shouldReceive('getFactionAbas')->andReturn([
            'data' => [],
        ]);
    });

    // 2. Prior to sync, verify no checkboxes or tags are applied
    $initialRow = RosterContent::find($this->contentRow->id);
    expect($initialRow->content['name'])->toBe('John Doe');
    expect($initialRow->content['name_cb'] ?? [])->toBeEmpty();
    expect($initialRow->content['name_tags'] ?? [])->toBeEmpty();

    // 3. Trigger sync
    $response = $this->actingAs($this->leader)->postJson('/api/factions/lssd/integrations/gtaw/sync');
    $response->assertStatus(200);

    // 4. Verify John Doe was created in CHARS database
    $dbEntry = $this->charDb->entries()->where('is_active', true)->first();
    expect($dbEntry)->not->toBeNull();
    expect($dbEntry->data['name'])->toBe('John Doe');

    // 5. Verify the roster content row is now linked to entry_id and auto-applied rules are triggered
    $updatedRow = RosterContent::find($this->contentRow->id);
    expect($updatedRow->linked_id['name'])->toBe((int) $dbEntry->entry_id);
    expect($updatedRow->content['name'])->toBe('John Doe');
    expect($updatedRow->content['name_cb'])->toContain('Acting Officer');
    expect($updatedRow->content['name_tags'])->toContain('Command');
});

test('syncing gtaw removes auto-applied checkboxes and tags if entry is removed (vice-versa)', function () {
    // 1. Mock GtawService to return John Doe on the first call, and an empty members list on the second call
    $this->mock(GtawService::class, function ($mock) {
        $mock->shouldReceive('getFactionMembers')
            ->twice()
            ->andReturn(
                [
                    'data' => [
                        'members' => [
                            [
                                'character_id' => 12345,
                                'character_name' => 'John Doe',
                                'rank_name' => 'Acting Sheriff',
                                'rank' => 15,
                                'abas' => 0.00,
                                'user_id' => 789,
                            ],
                        ],
                    ],
                ],
                [
                    'data' => [
                        'members' => [],
                    ],
                ]
            );

        $mock->shouldReceive('getFactionAbas')
            ->twice()
            ->andReturn(['data' => []]);
    });

    // First sync
    $response = $this->actingAs($this->leader)->postJson('/api/factions/lssd/integrations/gtaw/sync');
    $response->assertStatus(200);

    // Verify checkbox and tag applied
    $updatedRow = RosterContent::find($this->contentRow->id);
    expect($updatedRow->content['name_cb'])->toContain('Acting Officer');
    expect($updatedRow->content['name_tags'])->toContain('Command');

    // Second sync (John Doe removed)
    $response2 = $this->actingAs($this->leader)->postJson('/api/factions/lssd/integrations/gtaw/sync');
    $response2->assertStatus(200);

    // 3. Verify John Doe was soft-deleted
    $dbEntry = $this->charDb->entries()->withTrashed()->first();
    expect($dbEntry->trashed())->toBeTrue();

    // 4. Verify checkbox and tag have been un-applied / removed since the character is no longer active in database
    $finalRow = RosterContent::find($this->contentRow->id);
    expect($finalRow->content['name_cb'] ?? [])->toBeEmpty();
    expect($finalRow->content['name_tags'] ?? [])->toBeEmpty();
});

test('syncing gtaw does not crash when linked roster column contains float or decimal string', function () {
    // 1. Set up a roster row with a float/decimal string value like "1.05"
    $decimalRow = $this->section->contents()->create([
        'type' => 'predefined',
        'content' => [
            'name' => '1.05',
            'name_cb' => [],
            'name_tags' => [],
        ],
        'created_by' => $this->leader->id,
    ]);

    // 2. Mock GtawService to return a list of members
    $this->mock(GtawService::class, function ($mock) {
        $mock->shouldReceive('getFactionMembers')->andReturn([
            'data' => [
                'members' => [
                    [
                        'character_id' => 12345,
                        'character_name' => 'John Doe',
                        'rank_name' => 'Acting Sheriff',
                        'rank' => 15,
                        'abas' => 0.00,
                        'user_id' => 789,
                    ],
                ],
            ],
        ]);

        $mock->shouldReceive('getFactionAbas')->andReturn([
            'data' => [],
        ]);
    });

    // 3. Trigger sync and verify it completes successfully without crashing
    $response = $this->actingAs($this->leader)->postJson('/api/factions/lssd/integrations/gtaw/sync');
    $response->assertStatus(200);

    // 4. Verify the row value "1.05" remains unchanged
    $updatedRow = RosterContent::find($decimalRow->id);
    expect($updatedRow->content['name'])->toBe('1.05');
});

test('syncing gtaw does not crash when linked roster column contains array representing linked_roster_data', function () {
    // 1. Create a primary row (John Doe)
    $primaryRow = $this->section->contents()->create([
        'type' => 'predefined',
        'content' => [
            'name' => 'John Doe',
            'name_cb' => [],
            'name_tags' => [],
        ],
        'created_by' => $this->leader->id,
    ]);

    // 2. Create another row that links to the primary row (represented as an array)
    $linkedRow = $this->section->contents()->create([
        'type' => 'predefined',
        'content' => [
            'name' => [
                'row_id' => $primaryRow->id,
                'col_id' => 'name',
            ],
            'name_cb' => [],
            'name_tags' => [],
        ],
        'created_by' => $this->leader->id,
    ]);

    // 3. Mock GtawService to return a list of members containing John Doe
    $this->mock(GtawService::class, function ($mock) {
        $mock->shouldReceive('getFactionMembers')->andReturn([
            'data' => [
                'members' => [
                    [
                        'character_id' => 12345,
                        'character_name' => 'John Doe',
                        'rank_name' => 'Acting Sheriff',
                        'rank' => 15,
                        'abas' => 0.00,
                        'user_id' => 789,
                    ],
                ],
            ],
        ]);

        $mock->shouldReceive('getFactionAbas')->andReturn([
            'data' => [],
        ]);
    });

    // 4. Trigger sync and verify it completes successfully without type errors
    $response = $this->actingAs($this->leader)->postJson('/api/factions/lssd/integrations/gtaw/sync');
    $response->assertStatus(200);

    // 5. Verify the linked row has resolved name to entry ID
    $dbEntry = $this->charDb->entries()->where('is_active', true)->first();
    expect($dbEntry)->not->toBeNull();

    $updatedLinkedRow = RosterContent::find($linkedRow->id);
    expect($updatedLinkedRow->linked_id['name'])->toBeArray();
    expect($updatedLinkedRow->linked_id['name']['row_id'])->toBe($primaryRow->id);
    expect($updatedLinkedRow->content['name'])->toBe('John Doe');
    expect($updatedLinkedRow->content['name_cb'])->toContain('Acting Officer');
});

test('syncing gtaw auto-heals roster entry IDs pointing to old database entries by searching for character name in all databases of the faction', function () {
    // 1. Create a dummy "old" database belonging to this faction
    $oldDb = FactionRecordDatabase::create([
        'faction_id' => $this->faction->id,
        'name' => 'Old Characters Database',
        'record_shortcode' => 'CHARS_OLD',
        'database_structure' => [
            ['id' => 'name', 'name' => 'Name', 'type' => 'text', 'required' => true],
        ],
        'is_published' => true,
        'created_by' => $this->leader->id,
    ]);

    // Create a record in the old database for John Doe with entry ID 99999
    $oldDb->entries()->create([
        'entry_id' => 99999,
        'data' => ['name' => 'John Doe'],
        'is_active' => true,
        'created_by' => $this->leader->id,
    ]);

    // 2. Set the roster row to point to the old entry ID (99999)
    $decimalRow = $this->section->contents()->create([
        'type' => 'predefined',
        'content' => [
            'name' => 99999,
            'name_cb' => [],
            'name_tags' => [],
        ],
        'created_by' => $this->leader->id,
    ]);

    // 3. Mock GtawService to return John Doe as a member
    $this->mock(GtawService::class, function ($mock) {
        $mock->shouldReceive('getFactionMembers')->andReturn([
            'data' => [
                'members' => [
                    [
                        'character_id' => 12345,
                        'character_name' => 'John Doe',
                        'rank_name' => 'Acting Sheriff',
                        'rank' => 15,
                        'abas' => 0.00,
                        'user_id' => 789,
                    ],
                ],
            ],
        ]);

        $mock->shouldReceive('getFactionAbas')->andReturn([
            'data' => [],
        ]);
    });

    // 4. Trigger sync
    $response = $this->actingAs($this->leader)->postJson('/api/factions/lssd/integrations/gtaw/sync');
    $response->assertStatus(200);

    // 5. Verify the active entry ID in new CHARS database is something else (not 99999)
    $activeEntry = $this->charDb->entries()->where('is_active', true)->first();
    expect($activeEntry)->not->toBeNull();
    expect($activeEntry->entry_id)->not->toBe(99999);

    // 6. Verify that the roster row value got auto-healed to the new entry ID!
    $updatedRow = RosterContent::find($decimalRow->id);
    expect($updatedRow->linked_id['name'])->toBe((int) $activeEntry->entry_id);
    expect($updatedRow->content['name'])->toBe('John Doe');
    expect($updatedRow->content['name_cb'])->toContain('Acting Officer');
});

test('when member is cleared or removed from roster cell, gtaw sync does not add them back and de-links cell', function () {
    // 1. Initial sync with John Doe
    $this->mock(GtawService::class, function ($mock) {
        $mock->shouldReceive('getFactionMembers')->andReturn([
            'data' => [
                'members' => [
                    [
                        'character_id' => 12345,
                        'character_name' => 'John Doe',
                        'rank_name' => 'Acting Sheriff',
                        'rank' => 15,
                        'abas' => 0.00,
                        'user_id' => 789,
                    ],
                ],
            ],
        ]);
        $mock->shouldReceive('getFactionAbas')->andReturn(['data' => []]);
    });

    $response = $this->actingAs($this->leader)->postJson('/api/factions/lssd/integrations/gtaw/sync');
    $response->assertStatus(200);

    $row = RosterContent::find($this->contentRow->id);
    expect($row->content['name'])->toBe('John Doe');
    expect($row->linked_id['name'])->not->toBeNull();

    // 2. User removes John Doe from this roster cell (clears it)
    $row->update([
        'content' => ['name' => '', 'name_cb' => ['Acting Officer'], 'name_tags' => ['Command']],
        'linked_id' => $row->linked_id,
        'linked_display' => $row->linked_display,
    ]);

    // 3. Re-run GTA:W sync (John Doe is still in GTA:W faction)
    $response2 = $this->actingAs($this->leader)->postJson('/api/factions/lssd/integrations/gtaw/sync');
    $response2->assertStatus(200);

    // 4. Verify John Doe was NOT added back to this cleared cell, cell was de-linked, and auto-applied rules removed
    $updatedRow = RosterContent::find($this->contentRow->id);
    expect($updatedRow->content['name'])->toBe('');
    expect($updatedRow->linked_id['name'] ?? null)->toBeNull();
    expect($updatedRow->linked_display['name'] ?? null)->toBeNull();
    expect($updatedRow->content['name_cb'] ?? [])->toBeEmpty();
    expect($updatedRow->content['name_tags'] ?? [])->toBeEmpty();
});

test('when member name is changed on roster to non-matching name, gtaw sync de-links cell and preserves new name', function () {
    // 1. Initial sync with John Doe
    $this->mock(GtawService::class, function ($mock) {
        $mock->shouldReceive('getFactionMembers')->andReturn([
            'data' => [
                'members' => [
                    [
                        'character_id' => 12345,
                        'character_name' => 'John Doe',
                        'rank_name' => 'Acting Sheriff',
                        'rank' => 15,
                        'abas' => 0.00,
                        'user_id' => 789,
                    ],
                ],
            ],
        ]);
        $mock->shouldReceive('getFactionAbas')->andReturn(['data' => []]);
    });

    $response = $this->actingAs($this->leader)->postJson('/api/factions/lssd/integrations/gtaw/sync');
    $response->assertStatus(200);

    $row = RosterContent::find($this->contentRow->id);
    expect($row->content['name'])->toBe('John Doe');

    // 2. User types a custom name that doesn't match any GTA:W faction member
    $row->update([
        'content' => ['name' => 'Jane Smith', 'name_cb' => ['Acting Officer'], 'name_tags' => ['Command']],
        'linked_id' => $row->linked_id,
        'linked_display' => $row->linked_display,
    ]);

    // 3. Re-run GTA:W sync
    $response2 = $this->actingAs($this->leader)->postJson('/api/factions/lssd/integrations/gtaw/sync');
    $response2->assertStatus(200);

    // 4. Verify the new name is preserved, cell is de-linked, and auto-applied rules removed
    $updatedRow = RosterContent::find($this->contentRow->id);
    expect($updatedRow->content['name'])->toBe('Jane Smith');
    expect($updatedRow->linked_id['name'] ?? null)->toBeNull();
    expect($updatedRow->linked_display['name'] ?? null)->toBeNull();
    expect($updatedRow->content['name_cb'] ?? [])->toBeEmpty();
    expect($updatedRow->content['name_tags'] ?? [])->toBeEmpty();
});

test('roster content update API endpoint de-links stale linked_id and linked_display when cell is edited', function () {
    $row = RosterContent::create([
        'section_id' => $this->section->id,
        'type' => 'predefined',
        'content' => ['name' => 'John Doe'],
        'linked_id' => ['name' => 101],
        'linked_display' => ['name' => 'John Doe'],
        'created_by' => $this->leader->id,
    ]);

    // Update cell via controller endpoint
    $response = $this->actingAs($this->leader)->putJson("/api/contents/{$row->id}", [
        'content' => ['name' => 'Jane Smith'],
    ]);
    $response->assertStatus(200);

    $updatedRow = RosterContent::find($row->id);
    expect($updatedRow->content['name'])->toBe('Jane Smith');
    expect($updatedRow->linked_id['name'] ?? null)->toBeNull();
    expect($updatedRow->linked_display['name'] ?? null)->toBeNull();
});
