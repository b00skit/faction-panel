<?php

use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Models\FactionRecordEntry;
use App\Models\Roster;
use App\Models\RosterContent;
use App\Models\RosterSection;
use App\Models\User;
use App\Services\RosterSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('migration and RosterSyncService update linked_id, linked_display and copy display to content', function () {
    $faction = Faction::create(['name' => 'Test Faction', 'shortname' => 'testfac', 'color' => '#123456']);
    $user = User::factory()->create();

    // Create a Characters Database
    $charDb = FactionRecordDatabase::create([
        'faction_id' => $faction->id,
        'name' => 'Characters',
        'shortcode' => 'CHARS',
        'is_api_database' => 'gtaw_characters',
        'database_structure' => [
            ['id' => 'name', 'label' => 'Name', 'type' => 'text'],
            ['id' => 'rank', 'label' => 'Rank', 'type' => 'text'],
        ],
    ]);

    // Create active entry (entry_id 101 => Ashley Rogers)
    $entry1 = FactionRecordEntry::create([
        'database_id' => $charDb->id,
        'entry_id' => 101,
        'data' => ['name' => 'Ashley Rogers', 'rank' => 'Officer', 'char_id' => 101],
        'is_active' => true,
    ]);

    // Create Roster with a column linked to CHARS DB
    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'Main Roster',
        'shortname' => 'main-roster',
        'color' => '#123456',
        'columns' => [
            ['id' => 'col_member', 'name' => 'Member', 'type' => 'database_entry', 'linked_database_id' => $charDb->id],
        ],
        'created_by' => $user->id,
    ]);

    $section = RosterSection::create([
        'roster_id' => $roster->id,
        'name' => 'Command',
        'shortname' => 'command',
        'type' => 'static',
        'created_by' => $user->id,
    ]);

    // Create legacy content storing integer entry_id `101` in content
    $content = RosterContent::create([
        'section_id' => $section->id,
        'order' => 1,
        'type' => 'defined',
        'content' => ['col_member' => 101],
        'created_by' => $user->id,
    ]);

    // Sync roster via RosterSyncService
    $syncService = new RosterSyncService;
    $syncService->syncFaction($faction);

    $content->refresh();

    expect($content->linked_id['col_member'])->toBe(101);
    expect($content->linked_display['col_member'])->toBe('Ashley Rogers');
    expect($content->content['col_member'])->toBe('Ashley Rogers');
});

test('linked_display and content retain character display string when entry is removed or inactive', function () {
    $faction = Faction::create(['name' => 'Test Faction 2', 'shortname' => 'testfac2', 'color' => '#654321']);
    $user = User::factory()->create();

    $charDb = FactionRecordDatabase::create([
        'faction_id' => $faction->id,
        'name' => 'Characters',
        'shortcode' => 'CHARS',
        'is_api_database' => 'gtaw_characters',
        'database_structure' => [
            ['id' => 'name', 'label' => 'Name', 'type' => 'text'],
        ],
    ]);

    $entry = FactionRecordEntry::create([
        'database_id' => $charDb->id,
        'entry_id' => 202,
        'data' => ['name' => 'Eliana Kingsley', 'char_id' => 202],
        'is_active' => true,
    ]);

    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'Patrol Roster',
        'shortname' => 'patrol-roster',
        'color' => '#654321',
        'columns' => [
            ['id' => 'col_name', 'name' => 'Officer Name', 'type' => 'database_entry', 'linked_database_id' => $charDb->id],
        ],
        'created_by' => $user->id,
    ]);

    $section = RosterSection::create([
        'roster_id' => $roster->id,
        'name' => 'Patrol',
        'shortname' => 'patrol',
        'type' => 'static',
        'created_by' => $user->id,
    ]);

    $content = RosterContent::create([
        'section_id' => $section->id,
        'order' => 1,
        'type' => 'defined',
        'content' => ['col_name' => 202],
        'linked_id' => ['col_name' => 202],
        'linked_display' => ['col_name' => 'Eliana Kingsley'],
        'created_by' => $user->id,
    ]);

    // Now delete or deactivate entry 202 (person left faction)
    $entry->delete();

    // Re-sync
    $syncService = new RosterSyncService;
    $syncService->syncFaction($faction);

    $content->refresh();

    // Display string is preserved as text and cell is de-linked
    expect($content->content['col_name'])->toBe('Eliana Kingsley');
    expect($content->linked_id['col_name'] ?? null)->toBeNull();
    expect($content->linked_display['col_name'] ?? null)->toBeNull();
});

test('clearing a roster cell removes linked_id and sync does not restore the removed member', function () {
    $faction = Faction::create(['name' => 'Test Faction 3', 'shortname' => 'testfac3', 'color' => '#123123']);
    $user = User::factory()->create();

    $charDb = FactionRecordDatabase::create([
        'faction_id' => $faction->id,
        'name' => 'Characters',
        'shortcode' => 'CHARS',
        'is_api_database' => 'gtaw_characters',
        'database_structure' => [
            ['id' => 'name', 'label' => 'Name', 'type' => 'text'],
        ],
    ]);

    $entry = FactionRecordEntry::create([
        'database_id' => $charDb->id,
        'entry_id' => 303,
        'data' => ['name' => 'Officer Bob', 'char_id' => 303],
        'is_active' => true,
    ]);

    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'Roster 3',
        'shortname' => 'roster-3',
        'color' => '#123123',
        'columns' => [
            ['id' => 'col_name', 'name' => 'Officer Name', 'type' => 'database_entry', 'linked_database_id' => $charDb->id],
        ],
        'created_by' => $user->id,
    ]);

    $section = RosterSection::create([
        'roster_id' => $roster->id,
        'name' => 'Section 3',
        'shortname' => 'sec3',
        'type' => 'static',
        'created_by' => $user->id,
    ]);

    // Roster content was linked to Officer Bob
    $content = RosterContent::create([
        'section_id' => $section->id,
        'order' => 1,
        'type' => 'defined',
        'content' => ['col_name' => 'Officer Bob'],
        'linked_id' => ['col_name' => 303],
        'linked_display' => ['col_name' => 'Officer Bob'],
        'created_by' => $user->id,
    ]);

    // User removes Officer Bob from roster (cell cleared to empty string)
    $content->update([
        'content' => ['col_name' => ''],
    ]);

    // Re-sync
    $syncService = new RosterSyncService;
    $syncService->syncFaction($faction);

    $content->refresh();

    // Roster content remains empty and is de-linked (Officer Bob is NOT added back!)
    expect($content->content['col_name'])->toBe('');
    expect($content->linked_id['col_name'] ?? null)->toBeNull();
    expect($content->linked_display['col_name'] ?? null)->toBeNull();
});
