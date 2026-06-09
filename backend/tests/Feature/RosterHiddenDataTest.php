<?php

use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Models\Role;
use App\Models\Roster;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

beforeEach(function () {
    // Create leader and normal user
    $this->leader = User::factory()->create();
    $this->user = User::factory()->create();

    // Create a faction
    $this->faction = Faction::factory()->create([
        'faction_leader' => $this->leader->id,
        'created_by' => $this->leader->id,
        'shortname' => 'lssd',
        'visibility' => 'public',
        'access' => 'invite-only',
    ]);

    // Attach user to faction
    $this->faction->users()->attach($this->user->id);

    // Give default User role to $this->user (User role gets view_faction_roster = YES, but lacks any custom roster permission)
    $this->userRole = $this->faction->roles()->create([
        'name' => 'User',
        'weight' => 1,
        'color' => '#d1d5db',
        'type' => 'primary',
    ]);
    $this->userRole->permissions()->create(['permission_key' => 'view_faction_roster', 'value' => 'YES']);
    $this->user->roles()->attach($this->userRole->id);

    // Create a roster with columns (including a hidden one)
    $this->roster = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'Main Roster',
        'shortname' => 'ROST',
        'color' => '#123456',
        'order' => 0,
        'columns' => [
            ['id' => 'name', 'name' => 'Name', 'type' => 'text'],
            ['id' => 'secret_info', 'name' => 'Secret Info', 'type' => 'hidden_text'],
        ],
        'created_by' => $this->leader->id,
    ]);

    // Create a section
    $this->section = $this->roster->sections()->create([
        'name' => 'Main Section',
        'shortname' => 'MAIN',
        'type' => 'master',
        'order' => 0,
        'created_by' => $this->leader->id,
    ]);

    // Create a content row
    $this->content = $this->section->contents()->create([
        'type' => 'predefined',
        'content' => [
            'name' => 'John Doe',
            'secret_info' => 'This is a secret',
        ],
        'created_by' => $this->leader->id,
    ]);

    // Create a record database
    $this->recordDb = FactionRecordDatabase::create([
        'faction_id' => $this->faction->id,
        'name' => 'Incidents',
        'description' => 'Incident database',
        'record_shortcode' => 'INC',
        'data_overview_display' => 'table',
        'data_entry_display' => 'detailed',
        'is_published' => true,
        'database_structure' => [
            ['id' => 'name_field', 'name' => 'Name', 'type' => 'text', 'required' => true],
        ],
        'detail_customization' => [
            'roster_integration' => [
                'enabled' => true,
            ],
        ],
        'created_by' => $this->leader->id,
    ]);

    // Create public database permissions
    $this->recordDb->databasePermissions()->create([
        'permissions' => ['view_database'],
    ]);

    // Create an entry
    $this->entry = $this->recordDb->entries()->create([
        'database_id' => $this->recordDb->id,
        'entry_id' => 1,
        'data' => [
            'name_field' => 'John Doe',
        ],
        'is_active' => true,
        'created_by' => $this->leader->id,
    ]);
});

test('FactionController show masks hidden columns for unauthorized users', function () {
    // 1. Leader (authorized) should see the real secret info
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->leader)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    // Find the roster content
    $rosters = $data['rosters'];
    expect($rosters[0]['root_sections'][0]['contents'][0]['content']['secret_info'])->toBe('This is a secret');

    // 2. Normal user (unauthorized for hidden data) should see masked value ????
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    $rosters = $data['rosters'];
    expect(isset($rosters[0]['root_sections'][0]['contents'][0]['content']['secret_info']))->toBeFalse();
});

test('faction payload does not leak rosters relation', function () {
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    // The main faction object should not have a rosters relation
    expect(isset($data['faction']['rosters']))->toBeFalse();
});

test('RosterContentController update preserves hidden data for unauthorized users', function () {
    // 1. Grant public permission to edit defined fields
    $this->roster->rosterPermissions()->create([
        'permissions' => ['view_roster', 'edit_defined_fields'],
    ]);

    // 2. Normal user tries to update the row name, but does not provide secret_info
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->putJson("/api/contents/{$this->content->id}", [
        'content' => [
            'name' => 'Jane Doe',
        ],
    ]);

    $response->assertStatus(200);

    // Check that the name was updated, but the secret_info was preserved!
    $this->content->refresh();
    expect($this->content->content['name'])->toBe('Jane Doe');
    expect($this->content->content['secret_info'])->toBe('This is a secret');
});

test('RosterContentController update overwrites unauthorized modification attempt with existing hidden data', function () {
    // 1. Grant public permission to edit defined fields
    $this->roster->rosterPermissions()->create([
        'permissions' => ['view_roster', 'edit_defined_fields'],
    ]);

    // 2. Normal user tries to update, including changing the secret_info
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->putJson("/api/contents/{$this->content->id}", [
        'content' => [
            'name' => 'Jane Doe',
            'secret_info' => 'Modified secret', // unauthorized attempt
        ],
    ]);

    $response->assertStatus(200);

    // Check that the secret_info was restored to 'This is a secret'
    $this->content->refresh();
    expect($this->content->content['secret_info'])->toBe('This is a secret');
});

test('RosterContentController batchUpdate preserves hidden data for unauthorized users', function () {
    // 1. Grant public permission to edit defined fields
    $this->roster->rosterPermissions()->create([
        'permissions' => ['view_roster', 'edit_defined_fields'],
    ]);

    // 2. Normal user tries to batch update the row, including changing the secret_info
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->putJson("/api/sections/{$this->section->id}/contents/batch", [
        'contents' => [
            [
                'id' => $this->content->id,
                'content' => [
                    'name' => 'Jane Doe',
                    'secret_info' => 'Modified secret', // unauthorized attempt
                ],
            ],
        ],
    ]);

    $response->assertStatus(200);

    // Check that the secret_info was restored to 'This is a secret'
    $this->content->refresh();
    expect($this->content->content['secret_info'])->toBe('This is a secret');
});

test('FactionRecordEntryController show masks hidden columns in roster integrations for unauthorized users', function () {
    // 1. Grant public permission to view roster (but not hidden data)
    $this->roster->rosterPermissions()->create([
        'permissions' => ['view_roster'],
    ]);

    // 2. Add linked_database_id to name column
    $cols = $this->roster->columns;
    $cols[0]['linked_database_id'] = $this->recordDb->id;
    $cols[0]['database_field_id'] = 'name_field';
    $this->roster->update(['columns' => $cols]);

    // 3. Leader (authorized) should see unmasked secret_info in roster integrations
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->leader)->getJson("/api/factions/lssd/records/{$this->recordDb->id}/entries/{$this->entry->id}");
    $response->assertStatus(200);
    $data = $response->json();

    expect($data['roster_integrations'][0]['contents'][0]['content']['secret_info'])->toBe('This is a secret');

    // 4. Normal user (unauthorized for hidden data) should see masked value ????
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson("/api/factions/lssd/records/{$this->recordDb->id}/entries/{$this->entry->id}");
    $response->assertStatus(200);
    $data = $response->json();

    expect(isset($data['roster_integrations'][0]['contents'][0]['content']['secret_info']))->toBeFalse();
});

test('FactionController show masks hidden columns based on section-specific overrides', function () {
    $this->roster->rosterPermissions()->create([
        'permissions' => ['view_roster'],
    ]);

    $this->section->update([
        'use_roster_columns' => false,
        'columns' => [
            ['id' => 'name', 'name' => 'Name', 'type' => 'text'],
            ['id' => 'secret_info', 'name' => 'Secret Info', 'type' => 'text'], // NOT hidden in section!
            ['id' => 'another_secret', 'name' => 'Another Secret', 'type' => 'hidden_text'], // Hidden in section!
        ],
    ]);

    $this->content->update([
        'content' => [
            'name' => 'John Doe',
            'secret_info' => 'Not a secret anymore',
            'another_secret' => 'This is the new secret',
        ],
    ]);

    // 1. Leader should see both unmasked
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->leader)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    $c = $data['rosters'][0]['root_sections'][0]['contents'][0]['content'];
    expect($c['secret_info'])->toBe('Not a secret anymore');
    expect($c['another_secret'])->toBe('This is the new secret');

    // 2. Normal user should see 'secret_info' unmasked (since type is text in section)
    // but 'another_secret' masked (since type is hidden_text in section)
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    $c = $data['rosters'][0]['root_sections'][0]['contents'][0]['content'];
    expect($c['secret_info'])->toBe('Not a secret anymore');
    expect(isset($c['another_secret']))->toBeFalse();
});

test('FactionController show restricts record_data entries for view-only users', function () {
    $this->recordDb->databasePermissions()->whereNull('role_id')->delete();

    // 1. Create a second entry that is NOT referenced
    $secondEntry = $this->recordDb->entries()->create([
        'database_id' => $this->recordDb->id,
        'entry_id' => 2,
        'data' => [
            'name_field' => 'Jane Doe',
        ],
        'is_active' => true,
        'created_by' => $this->leader->id,
    ]);

    // 2. Link the name column of the roster to the database field 'name_field'
    $cols = $this->roster->columns;
    $cols[0]['linked_database_id'] = $this->recordDb->id;
    $cols[0]['database_field_id'] = 'name_field';
    $this->roster->update(['columns' => $cols]);

    // The roster has a content row with 'name' => 'John Doe' (matches entry 1's name_field).
    // So entry 1 is referenced, but entry 2 ('Jane Doe') is NOT referenced.

    // 3. User (view-only) fetches faction details.
    // They should only see entry 1 in record_data.
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    // Check record_data entries
    $dbData = collect($data['record_data'])->firstWhere('id', $this->recordDb->id);
    expect($dbData)->not->toBeNull();
    $entries = $dbData['entries'];

    // Should only have 1 entry (entry_id = 1)
    expect(count($entries))->toBe(1);
    expect($entries[0]['entry_id'])->toBe(1);
    expect($entries[0]['data']['name_field'])->toBe('John Doe');

    // 4. Leader (editor) fetches faction details.
    // They should see both entries.
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->leader)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    $dbData = collect($data['record_data'])->firstWhere('id', $this->recordDb->id);
    expect($dbData)->not->toBeNull();
    $entries = $dbData['entries'];

    expect(count($entries))->toBe(2);
});

test('FactionController show masks sensitive database fields for view-only users', function () {
    // 1. Link a column of type 'hidden_text' to the database field 'name_field'
    // Let's change the secret_info column to link to the database
    $cols = $this->roster->columns;
    $cols[1]['linked_database_id'] = $this->recordDb->id;
    $cols[1]['database_field_id'] = 'name_field';
    $this->roster->update(['columns' => $cols]);

    // The roster content row has: 'secret_info' => 'John Doe'
    // So the cell value 'John Doe' references entry 1.
    // But secret_info is of type hidden_text, and the user lacks view_hidden_data permission.
    // Therefore, the field 'name_field' is hidden, and its value in the database entry must be masked to '????'.

    $this->content->update([
        'content' => [
            'name' => 'Test',
            'secret_info' => 'John Doe',
        ],
    ]);

    // 2. User (view-only) fetches faction details.
    // They should see the entry, but its 'name_field' should be masked to '????'.
    // The entry_id and id should remain unmasked.
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    $dbData = collect($data['record_data'])->firstWhere('id', $this->recordDb->id);
    expect($dbData)->not->toBeNull();
    $entries = $dbData['entries'];

    expect(count($entries))->toBe(1);
    expect($entries[0]['entry_id'])->toBe(1);
    expect(isset($entries[0]['data']['name_field']))->toBeFalse();

    // 3. Leader (editor) fetches faction details.
    // They should see the entry with unmasked name_field.
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->leader)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    $dbData = collect($data['record_data'])->firstWhere('id', $this->recordDb->id);
    $entries = $dbData['entries'];
    expect($entries[0]['data']['name_field'])->toBe('John Doe');
});

test('FactionController show sends all entries unmasked to users with database edit permissions', function () {
    // 1. Create a second entry that is NOT referenced
    $secondEntry = $this->recordDb->entries()->create([
        'database_id' => $this->recordDb->id,
        'entry_id' => 2,
        'data' => [
            'name_field' => 'Jane Doe',
        ],
        'is_active' => true,
        'created_by' => $this->leader->id,
    ]);

    // 2. Link a hidden column to name_field
    $cols = $this->roster->columns;
    $cols[1]['linked_database_id'] = $this->recordDb->id;
    $cols[1]['database_field_id'] = 'name_field';
    $this->roster->update(['columns' => $cols]);

    $this->content->update([
        'content' => [
            'name' => 'Test',
            'secret_info' => 'John Doe',
        ],
    ]);

    // 3. Give $this->user a database permission to add_entries
    $this->recordDb->databasePermissions()->create([
        'role_id' => $this->userRole->id,
        'permissions' => ['view_database', 'add_entries'],
    ]);

    // 4. User (now an editor) fetches faction details.
    // They should see both entries, and they should be unmasked.
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    $dbData = collect($data['record_data'])->firstWhere('id', $this->recordDb->id);
    expect($dbData)->not->toBeNull();
    $entries = $dbData['entries'];

    expect(count($entries))->toBe(2);
    // Verify entry 1 is unmasked
    $e1 = collect($entries)->firstWhere('entry_id', 1);
    expect($e1['data']['name_field'])->toBe('John Doe');

    // Verify entry 2 is unmasked
    $e2 = collect($entries)->firstWhere('entry_id', 2);
    expect($e2['data']['name_field'])->toBe('Jane Doe');
});

test('FactionController show fetches database entries referenced via dynamic sections for view-only users', function () {
    $this->recordDb->databasePermissions()->whereNull('role_id')->delete();

    // 1. Create a dynamic section pointing to the database
    $dynamicSection = $this->roster->sections()->create([
        'name' => 'Dynamic Section',
        'shortname' => 'DYN',
        'type' => 'master',
        'order' => 1,
        'data_source' => 'dynamic',
        'section_options' => [
            'dynamic_config' => [
                'source_type' => 'database',
                'source_id' => $this->recordDb->id,
                'rules' => [],
                'mappings' => [
                    'name' => 'name_field',
                ],
            ],
        ],
        'created_by' => $this->leader->id,
    ]);

    // 2. Create another database with an entry that is NOT referenced
    $otherDb = FactionRecordDatabase::create([
        'faction_id' => $this->faction->id,
        'name' => 'Other DB',
        'description' => 'Other database',
        'record_shortcode' => 'OTH',
        'data_overview_display' => 'table',
        'data_entry_display' => 'detailed',
        'is_published' => true,
        'database_structure' => [
            ['id' => 'other_field', 'name' => 'Other Field', 'type' => 'text', 'required' => true],
        ],
        'created_by' => $this->leader->id,
    ]);

    $otherEntry = $otherDb->entries()->create([
        'database_id' => $otherDb->id,
        'entry_id' => 1,
        'data' => [
            'other_field' => 'Not Referenced',
        ],
        'is_active' => true,
        'created_by' => $this->leader->id,
    ]);

    // 3. User fetches faction details.
    // They should see the dynamic section resolved, and they should receive the entry from recordDb (since it's referenced in the dynamic section).
    // But they should NOT receive the entry from otherDb (since it's not referenced).
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    // Check dynamic section resolved content
    $rosters = $data['rosters'];
    $dynSec = collect($rosters[0]['root_sections'])->firstWhere('id', $dynamicSection->id);
    expect($dynSec)->not->toBeNull();
    expect(count($dynSec['contents']))->toBe(1);
    expect($dynSec['contents'][0]['content']['name'])->toBe('John Doe');

    // Check record_data
    $dbData = collect($data['record_data'])->firstWhere('id', $this->recordDb->id);
    expect(count($dbData['entries']))->toBe(1);
    expect($dbData['entries'][0]['entry_id'])->toBe(1);

    $otherDbData = collect($data['record_data'])->firstWhere('id', $otherDb->id);
    expect($otherDbData)->toBeNull();
});

test('FactionController show resolves linked_roster_data values to fetch referenced database entries for view-only users', function () {
    // 1. Create a second roster ("Roster B")
    $rosterB = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'Secondary Roster',
        'shortname' => 'SEC',
        'color' => '#654321',
        'order' => 1,
        'columns' => [
            [
                'id' => 'linked_name',
                'name' => 'Linked Name',
                'type' => 'linked_roster_data',
                'linked_database_id' => $this->recordDb->id,
                'database_field_id' => 'name_field',
            ],
            [
                'id' => 'database_data_col',
                'name' => 'DB Col',
                'type' => 'database_data',
                'source_column_id' => 'linked_name',
                'data_field_id' => 'name_field',
            ],
        ],
        'created_by' => $this->leader->id,
    ]);

    $sectionB = $rosterB->sections()->create([
        'name' => 'Secondary Section',
        'shortname' => 'SEC_MAIN',
        'type' => 'master',
        'order' => 0,
        'created_by' => $this->leader->id,
    ]);

    // Roster A (from beforeEach) has content row 1 with 'name' => 'John Doe' (ID: $this->content->id).
    // Create a content row on Roster B that has 'linked_name' pointing to Roster A's content row's 'name' field.
    $contentB = $sectionB->contents()->create([
        'type' => 'predefined',
        'content' => [
            'linked_name' => [
                'roster_id' => $this->roster->id,
                'section_id' => $this->section->id,
                'row_id' => $this->content->id,
                'col_id' => 'name',
            ],
        ],
        'created_by' => $this->leader->id,
    ]);

    // Clear user permissions cache and act as the view-only user
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    // The view-only user should receive the entry with name_field = 'John Doe' (entry_id = 1)
    // because Roster B's content linked_name resolves to 'John Doe' (matching database name_field).
    $dbData = collect($data['record_data'])->firstWhere('id', $this->recordDb->id);
    expect($dbData)->not->toBeNull();
    $entries = $dbData['entries'];

    expect(count($entries))->toBe(1);
    expect($entries[0]['entry_id'])->toBe(1);
    expect($entries[0]['data']['name_field'])->toBe('John Doe');
});

test('FactionController show respects use_roster_columns and resolves linked columns for global view-only users', function () {
    // 1. Create a second roster ("Roster B")
    $rosterB = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'Secondary Roster',
        'shortname' => 'SEC',
        'color' => '#654321',
        'order' => 1,
        'columns' => [
            [
                'id' => 'linked_name',
                'name' => 'Linked Name',
                'type' => 'linked_roster_data',
                'linked_database_id' => $this->recordDb->id,
                'database_field_id' => 'name_field',
            ],
            [
                'id' => 'database_data_col',
                'name' => 'DB Col',
                'type' => 'database_data',
                'source_column_id' => 'linked_name',
                'data_field_id' => 'name_field',
            ],
        ],
        'created_by' => $this->leader->id,
    ]);

    // Roster A (from beforeEach) has content row 1 with 'name' => 'John Doe' (ID: $this->content->id).
    // Create a section on Roster B that has use_roster_columns => true
    // but we save columns in it that defines 'linked_name' as type 'text' to test if it gets ignored.
    $sectionB = $rosterB->sections()->create([
        'name' => 'Secondary Section',
        'shortname' => 'SEC_MAIN',
        'type' => 'master',
        'order' => 0,
        'use_roster_columns' => true,
        'columns' => [
            [
                'id' => 'linked_name',
                'name' => 'Linked Name Override',
                'type' => 'text',
            ],
        ],
        'created_by' => $this->leader->id,
    ]);

    // Create content that has a link in it
    $contentB = $sectionB->contents()->create([
        'type' => 'predefined',
        'content' => [
            'linked_name' => [
                'roster_id' => $this->roster->id,
                'section_id' => $this->section->id,
                'row_id' => $this->content->id,
                'col_id' => 'name',
            ],
        ],
        'created_by' => $this->leader->id,
    ]);

    // Give user global view_faction_roster permission only (no explicit roster permission)
    $this->userRole->permissions()->delete();
    $this->userRole->permissions()->create(['permission_key' => 'view_faction_roster', 'value' => 'YES']);

    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    // Verify that the entry was resolved successfully
    $dbData = collect($data['record_data'])->firstWhere('id', $this->recordDb->id);
    expect($dbData)->not->toBeNull();
    $entries = $dbData['entries'];

    expect(count($entries))->toBe(1);
    expect($entries[0]['entry_id'])->toBe(1);
    expect($entries[0]['data']['name_field'])->toBe('John Doe');
});

test('FactionController show sends all database entries to users with roster edit permissions', function () {
    $this->recordDb->databasePermissions()->whereNull('role_id')->delete();

    // 1. Create a second database entry that is NOT referenced
    $secondEntry = $this->recordDb->entries()->create([
        'database_id' => $this->recordDb->id,
        'entry_id' => 2,
        'data' => [
            'name_field' => 'Jane Doe',
        ],
        'is_active' => true,
        'created_by' => $this->leader->id,
    ]);

    // Link the roster's name column to the database field
    $cols = $this->roster->columns;
    $cols[0]['linked_database_id'] = $this->recordDb->id;
    $cols[0]['database_field_id'] = 'name_field';
    $this->roster->update(['columns' => $cols]);

    // Roster content row 1 has name = John Doe, which references entry 1.
    // entry 2 (Jane Doe) is NOT referenced.

    // 2. Scenario A: User with ONLY view permissions on roster & database (view-only user)
    $this->userRole->permissions()->delete();
    $this->userRole->permissions()->create(['permission_key' => 'view_faction_roster', 'value' => 'YES']);

    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    $dbData = collect($data['record_data'])->firstWhere('id', $this->recordDb->id);
    expect($dbData)->not->toBeNull();
    // They should only see the referenced entry (1 entry)
    expect(count($dbData['entries']))->toBe(1);
    expect($dbData['entries'][0]['entry_id'])->toBe(1);

    // 3. Scenario B: User has edit permissions on the roster (but still view-only on database)
    // Add modify_roster permission explicitly to the roster
    $this->roster->rosterPermissions()->create([
        'role_id' => $this->userRole->id,
        'permissions' => ['view_roster', 'modify_roster'],
    ]);

    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    $dbData = collect($data['record_data'])->firstWhere('id', $this->recordDb->id);
    expect($dbData)->not->toBeNull();
    // They should see all entries (2 entries) since they are not a view-only user
    expect(count($dbData['entries']))->toBe(2);
});

test('FactionController show does not crash when linked column contains decimal string or temp values for guest/unlogged users', function () {
    // 1. Create a Public role with view_faction_roster permission so guest is authorized to view
    $publicRole = $this->faction->roles()->create([
        'name' => 'Public',
        'weight' => 0,
        'color' => '#d1d5db',
        'type' => 'secondary',
    ]);
    $publicRole->permissions()->create(['permission_key' => 'view_faction_roster', 'value' => 'YES']);

    // 2. Link the roster's name column to the database field
    $cols = $this->roster->columns;
    $cols[0]['linked_database_id'] = $this->recordDb->id;
    $cols[0]['database_field_id'] = 'name_field';
    $this->roster->update(['columns' => $cols]);

    // 3. Set the roster content row to have a float string '0.99' and a temp string 'temp_123'
    $this->content->update([
        'content' => [
            'name' => '0.99',
            'secret_info' => 'temp_123',
        ],
    ]);

    // 4. Request faction panel as guest (unauthenticated)
    Auth::guard('sanctum')->forgetUser();
    $response = $this->getJson('/api/factions/lssd');

    // 5. Verify the response is successful (200) and did not fail with a 500 database exception
    $response->assertStatus(200);
    $data = $response->json();
    expect($data['rosters'])->not->toBeEmpty();
});
