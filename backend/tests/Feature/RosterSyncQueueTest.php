<?php

use App\Jobs\SyncRosterData;
use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Models\Roster;
use App\Models\User;
use App\Services\RosterSyncService;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->leader = User::factory()->create();

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

    // Create roles
    $this->adminRole = $this->faction->roles()->create(['name' => 'Administrator', 'weight' => 100, 'color' => '#ef4444', 'type' => 'primary']);
    $this->leader->roles()->attach($this->adminRole->id);

    // Global moderation permission
    $this->adminRole->permissions()->create(['permission_key' => 'global_roster_moderation', 'value' => 'YES']);

    // Create a database
    $this->recordDb = FactionRecordDatabase::create([
        'faction_id' => $this->faction->id,
        'name' => 'Personnel Records',
        'database_structure' => json_encode([
            ['id' => 'name_field', 'name' => 'Name', 'type' => 'text'],
            ['id' => 'status_field', 'name' => 'Status', 'type' => 'text'],
        ]),
        'is_published' => true,
        'created_by' => $this->leader->id,
    ]);

    // Create entry
    $this->recordDb->entries()->create([
        'database_id' => $this->recordDb->id,
        'entry_id' => 'JD01',
        'data' => [
            'name_field' => 'John Doe',
            'status_field' => 'Suspended',
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

    // Create a roster with auto-apply checkboxes
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
                'checkboxes' => [
                    [
                        'label' => 'Probation',
                        'auto_apply_field' => 'status_field',
                        'auto_apply_value' => 'Suspended',
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

    $this->content = $this->section->contents()->create([
        'type' => 'predefined',
        'content' => [
            'name' => 'JD01',
            'name_cb' => [], // Empty checkboxes initially
        ],
        'created_by' => $this->leader->id,
    ]);
});

test('sync-roster-data endpoint dispatches job', function () {
    Queue::fake();

    $response = $this->actingAs($this->leader)->postJson("/api/factions/{$this->faction->shortname}/sync-roster-data");

    $response->assertStatus(200);
    $response->assertJson(['message' => 'Roster data synchronization queued']);

    Queue::assertPushed(SyncRosterData::class, function ($job) {
        return $job->faction->id === $this->faction->id;
    });
});

test('SyncRosterData job correctly synchronizes data', function () {
    $job = new SyncRosterData($this->faction, $this->leader);
    $job->handle(new RosterSyncService);

    $this->content->refresh();

    expect($this->content->content['name_cb'])->toContain('Probation');
});
