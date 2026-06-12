<?php

use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Models\Roster;
use App\Models\User;
use App\Services\DynamicSectionService;

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

    // Create characters record database
    $this->recordDb = FactionRecordDatabase::create([
        'faction_id' => $this->faction->id,
        'name' => 'Characters Database',
        'database_structure' => [
            ['id' => 'name', 'name' => 'Character Name', 'type' => 'text'],
            ['id' => 'rank', 'name' => 'Rank', 'type' => 'text'],
        ],
        'data_overview_display' => 'table',
        'data_entry_display' => 'profile',
        'is_published' => true,
        'created_by' => $this->leader->id,
    ]);

    // Create record entries representing characters
    // Entry 1: Ashley Rogers
    $this->recordDb->entries()->create([
        'database_id' => $this->recordDb->id,
        'entry_id' => 1,
        'data' => [
            'name' => 'Ashley Rogers',
            'rank' => 'Deputy',
        ],
        'is_active' => true,
        'created_by' => $this->leader->id,
    ]);

    // Entry 2: Eliana Kingsley
    $this->recordDb->entries()->create([
        'database_id' => $this->recordDb->id,
        'entry_id' => 2,
        'data' => [
            'name' => 'Eliana Kingsley',
            'rank' => 'Deputy',
        ],
        'is_active' => true,
        'created_by' => $this->leader->id,
    ]);

    // Create a dataset linked to this database
    $this->dataset = $this->faction->rosterDatasets()->create([
        'name' => 'GTA:W Data',
        'type' => 'record_database',
        'record_database_id' => $this->recordDb->id,
        'created_by' => $this->leader->id,
    ]);

    // Create a master roster with a column linked to the dataset
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
                'database_field_id' => 'name',
            ],
            [
                'id' => 'rank',
                'name' => 'Rank',
                'type' => 'text',
            ],
        ],
        'created_by' => $this->leader->id,
    ]);

    $this->section = $this->roster->sections()->create([
        'name' => 'Active Duty',
        'shortname' => 'AD',
        'type' => 'master',
        'order' => 0,
        'created_by' => $this->leader->id,
    ]);

    // Add content: name points to entry_id 1 (Ashley Rogers)
    $this->content = $this->section->contents()->create([
        'type' => 'predefined',
        'content' => [
            'name' => 1, // Stored as integer ID of "Ashley Rogers"
            'rank' => 'Deputy',
        ],
        'created_by' => $this->leader->id,
    ]);
});

test('dynamic section not_in_roster rule resolves entry IDs to strings correctly', function () {
    // Create a dynamic section for "Lost Characters"
    // Source is the Characters Database (ID: recordDb->id)
    // Rule is not_in_roster for matching field 'name'
    $dynamicSection = $this->roster->sections()->create([
        'name' => 'Lost Characters',
        'shortname' => 'LOST',
        'type' => 'section',
        'order' => 1,
        'data_source' => 'dynamic',
        'section_options' => [
            'dynamic_config' => [
                'source_type' => 'database',
                'source_id' => (string) $this->recordDb->id,
                'mappings' => [
                    'name' => 'name',
                    'rank' => 'rank',
                ],
                'rules' => [
                    [
                        'type' => 'not_in_roster',
                        'roster_id' => 'all',
                        'match_field' => 'name',
                        'target_field' => 'name',
                    ],
                ],
            ],
        ],
        'created_by' => $this->leader->id,
    ]);

    // Resolve dynamic section content
    $service = new DynamicSectionService;
    $service->resolve($dynamicSection, $this->faction);

    // Retrieve resolved contents
    $resolvedContents = $dynamicSection->contents;

    // Ashley Rogers (entry_id 1) IS on the active duty roster (stored as integer `1` which resolves to "Ashley Rogers")
    // Eliana Kingsley (entry_id 2) IS NOT on the active duty roster.
    // Therefore, "Lost Characters" should ONLY contain Eliana Kingsley.
    expect($resolvedContents->count())->toBe(1);
    expect($resolvedContents->first()->content['name'])->toBe('Eliana Kingsley');
});
