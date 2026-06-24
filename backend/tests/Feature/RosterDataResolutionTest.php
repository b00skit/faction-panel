<?php

use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Models\Roster;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

beforeEach(function () {
    $this->leader = User::factory()->create();
    $this->user = User::factory()->create();

    $this->faction = Faction::create([
        'shortname' => 'lssd',
        'name' => 'Los Santos County Sheriff\'s Department',
        'color' => '#14571f',
        'visibility' => 'public',
        'access' => 'invite-only',
        'faction_leader' => $this->leader->id,
        'created_by' => $this->leader->id,
    ]);

    $this->faction->users()->attach($this->leader->id);
    $this->faction->users()->attach($this->user->id);

    // Create roles
    $this->adminRole = $this->faction->roles()->create(['name' => 'Administrator', 'weight' => 100, 'color' => '#ef4444', 'type' => 'primary']);
    $this->userRole = $this->faction->roles()->create(['name' => 'User', 'weight' => 1, 'color' => '#d1d5db', 'type' => 'primary']);

    $this->leader->roles()->attach($this->adminRole->id);
    $this->user->roles()->attach($this->userRole->id);

    // Default permissions
    $this->userRole->permissions()->create(['permission_key' => 'view_faction_roster', 'value' => 'YES']);

    // Create a database - PUBLIC USER HAS NO PERMISSION TO VIEW THIS DIRECTLY
    $this->recordDb = FactionRecordDatabase::create([
        'faction_id' => $this->faction->id,
        'name' => 'Personnel Records',
        'database_structure' => json_encode([
            ['id' => 'name_field', 'name' => 'Name', 'type' => 'text'],
            ['id' => 'abas_field', 'name' => 'ABAS', 'type' => 'text'],
        ]),
        'data_overview_display' => json_encode([]),
        'data_entry_display' => json_encode([]),
        'is_published' => true,
        'created_by' => $this->leader->id,
    ]);

    // Create entries
    $this->recordDb->entries()->create([
        'database_id' => $this->recordDb->id,
        'entry_id' => 1,
        'data' => [
            'name_field' => 'John Doe',
            'abas_field' => 'Top Secret ABAS',
        ],
        'is_active' => true,
        'created_by' => $this->leader->id,
    ]);

    // Create a dataset
    $this->dataset = $this->faction->rosterDatasets()->create([
        'name' => 'Personnel',
        'type' => 'record_database',
        'record_database_id' => $this->recordDb->id,
        'created_by' => $this->leader->id,
    ]);

    // Create a roster with database_data column
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
                'type' => 'text',
                'dataset_id' => $this->dataset->id,
                'database_field_id' => 'name_field',
            ],
            [
                'id' => 'abas',
                'name' => 'ABAS',
                'type' => 'database_data',
                'source_column_id' => 'name',
                'data_field_id' => 'abas_field',
            ],
        ],
        'created_by' => $this->leader->id,
    ]);

    // Grant view access to the user's role so it is visible in the tests
    $this->roster->rosterPermissions()->create([
        'role_id' => $this->userRole->id,
        'permissions' => ['view_roster'],
    ]);

    $this->section = $this->roster->sections()->create([
        'name' => 'HQ',
        'shortname' => 'HQ',
        'type' => 'master',
        'order' => 0,
        'created_by' => $this->leader->id,
    ]);

    $this->content = $this->section->contents()->create([
        'type' => 'predefined',
        'content' => [
            'name' => 'John Doe',
            // 'abas' is resolved from the database
        ],
        'created_by' => $this->leader->id,
    ]);
});

test('view-only users should see masked resolved data in faction show (fixed empty column)', function () {
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    $roster = collect($data['rosters'])->firstWhere('id', $this->roster->id);
    $content = $roster['root_sections'][0]['contents'][0]['content'];

    // Key 'abas' should exist and be resolved (no longer masked unless it's a hidden type)
    expect($content)->toHaveKey('abas');
    expect($content['abas'])->toBe('Top Secret ABAS');

    // The database should be included in record_data because it's referenced
    $recordData = collect($data['record_data']);
    expect($recordData->count())->toBe(1);
    expect($recordData->first()['id'])->toBe($this->recordDb->id);

    // BUT it should ONLY have the referenced entries (in this case 1)
    expect(count($recordData->first()['entries']))->toBe(1);
});

test('view-only users should see masked resolved data for hidden_database_data type', function () {
    // Add a hidden_database_data column
    $columns = $this->roster->columns;
    $columns[] = [
        'id' => 'secret_abas',
        'name' => 'Secret ABAS',
        'type' => 'hidden_database_data',
        'source_column_id' => 'name',
        'data_field_id' => 'abas_field',
    ];
    $this->roster->update(['columns' => $columns]);

    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    $roster = collect($data['rosters'])->firstWhere('id', $this->roster->id);
    $content = $roster['root_sections'][0]['contents'][0]['content'];

    // 'abas' (database_data) should be visible
    expect($content['abas'])->toBe('Top Secret ABAS');

    // 'secret_abas' (hidden_database_data) should be masked
    expect($content['secret_abas'])->toBe('????');
});

test('editors should see unmasked resolved data', function () {
    // Grant modify_roster permission
    $this->roster->rosterPermissions()->create([
        'role_id' => $this->userRole->id,
        'permissions' => ['view_roster', 'modify_roster'],
    ]);

    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    $roster = collect($data['rosters'])->firstWhere('id', $this->roster->id);
    $content = $roster['root_sections'][0]['contents'][0]['content'];

    // Key 'abas' should exist and be resolved
    expect($content)->toHaveKey('abas');
    expect($content['abas'])->toBe('Top Secret ABAS');
});
