<?php

use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Models\FactionRecordEntry;
use App\Models\Form;
use App\Models\FormComment;
use App\Models\FormSubmission;
use App\Models\Roster;
use App\Models\RosterContent;
use App\Models\RosterDataset;
use App\Models\RosterDatasetOption;
use App\Models\RosterSection;
use App\Models\User;

test('deleting a user cascades form submissions and comments, but preserves other users submissions', function () {
    $leader = User::factory()->create();
    $targetUser = User::factory()->create();
    $otherUser = User::factory()->create();

    $faction = Faction::factory()->create([
        'faction_leader' => $leader->id,
        'created_by' => $leader->id,
    ]);

    $form = Form::factory()->create([
        'faction_id' => $faction->id,
        'created_by' => $leader->id,
    ]);

    // Create target user's submission
    $targetSubmission = FormSubmission::create([
        'form_id' => $form->id,
        'user_id' => $targetUser->id,
        'started_at' => now(),
    ]);

    // Create target user's comment on their own submission
    FormComment::create([
        'form_submission_id' => $targetSubmission->id,
        'user_id' => $targetUser->id,
        'comment' => 'Target comment',
    ]);

    // Create other user's submission
    $otherSubmission = FormSubmission::create([
        'form_id' => $form->id,
        'user_id' => $otherUser->id,
        'started_at' => now(),
    ]);

    // Create target user's comment on other user's submission
    $targetCommentOnOther = FormComment::create([
        'form_submission_id' => $otherSubmission->id,
        'user_id' => $targetUser->id,
        'comment' => 'Target reviewer comment',
    ]);

    // Delete the target user
    $targetUser->delete();

    // Assert target user is deleted
    $this->assertDatabaseMissing('users', ['id' => $targetUser->id]);

    // Assert target user's submission is cascade deleted
    $this->assertDatabaseMissing('form_submissions', ['id' => $targetSubmission->id]);

    // Assert target user's comment is cascade deleted
    $this->assertDatabaseMissing('form_comments', ['id' => $targetCommentOnOther->id]);

    // Assert other user's submission remains untouched
    $this->assertDatabaseHas('form_submissions', ['id' => $otherSubmission->id]);
    $this->assertDatabaseHas('users', ['id' => $otherUser->id]);
});

test('deleting a dataset cascade-deletes options and falls back gracefully in roster payload resolution', function () {
    $leader = User::factory()->create();
    $faction = Faction::factory()->create([
        'faction_leader' => $leader->id,
        'created_by' => $leader->id,
    ]);

    // Create dataset
    $dataset = RosterDataset::create([
        'faction_id' => $faction->id,
        'name' => 'Ranks Dataset',
    ]);

    // Create options
    $option1 = RosterDatasetOption::create([
        'roster_dataset_id' => $dataset->id,
        'value' => 'Sergeant',
        'order' => 1,
    ]);

    $option2 = RosterDatasetOption::create([
        'roster_dataset_id' => $dataset->id,
        'value' => 'Officer',
        'order' => 2,
    ]);

    // Create Roster with a column bound to this dataset
    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'Main Roster',
        'shortname' => 'MAIN',
        'color' => '#ffffff',
        'columns' => [
            [
                'id' => 'rank',
                'name' => 'Rank',
                'type' => 'dropdown',
                'dataset_id' => $dataset->id,
            ],
        ],
        'created_by' => $leader->id,
    ]);

    $section = RosterSection::create([
        'roster_id' => $roster->id,
        'name' => 'Patrol Division',
        'shortname' => 'PATROL',
        'type' => 'master',
        'created_by' => $leader->id,
    ]);

    // Create RosterContent containing the option ID as the cell value
    $content = RosterContent::create([
        'section_id' => $section->id,
        'content' => [
            'rank' => (string) $option1->id,
        ],
        'created_by' => $leader->id,
    ]);

    // 1. Verify before deletion: the faction payload includes the dataset with its options
    // and the rank cell value is returned as the raw option ID (as expected since frontend resolves it)
    $faction->users()->attach($leader->id);
    $response = $this->actingAs($leader)->getJson("/api/factions/{$faction->shortname}");
    $response->assertStatus(200);

    $datasetsBefore = collect($response->json('datasets'));
    expect($datasetsBefore->firstWhere('id', $dataset->id))->not->toBeNull();

    $rosters = $response->json('rosters');
    $firstRoster = collect($rosters)->firstWhere('id', $roster->id);
    $resolvedValue = $firstRoster['root_sections'][0]['contents'][0]['content']['rank'];
    expect($resolvedValue)->toBe((string) $option1->id);

    // 2. Delete the dataset
    $dataset->delete();

    // Assert dataset is deleted
    $this->assertDatabaseMissing('roster_datasets', ['id' => $dataset->id]);

    // Assert options are cascade-deleted
    $this->assertDatabaseMissing('roster_dataset_options', ['id' => $option1->id]);
    $this->assertDatabaseMissing('roster_dataset_options', ['id' => $option2->id]);

    // 3. Verify after deletion: fetching faction payload does not crash and dataset is missing
    $responseAfter = $this->actingAs($leader)->getJson("/api/factions/{$faction->shortname}");
    $responseAfter->assertStatus(200);

    $datasetsAfter = collect($responseAfter->json('datasets'));
    expect($datasetsAfter->firstWhere('id', $dataset->id))->toBeNull();

    $rostersAfter = $responseAfter->json('rosters');
    $firstRosterAfter = collect($rostersAfter)->firstWhere('id', $roster->id);
    $resolvedValueAfter = $firstRosterAfter['root_sections'][0]['contents'][0]['content']['rank'];
    expect($resolvedValueAfter)->toBe((string) $option1->id);
});

test('deleting a record database cascade-deletes entries and nullifies dataset record_database_id link', function () {
    $leader = User::factory()->create();
    $faction = Faction::factory()->create([
        'faction_leader' => $leader->id,
        'created_by' => $leader->id,
    ]);

    // Create Record Database
    $recordDb = FactionRecordDatabase::create([
        'faction_id' => $faction->id,
        'name' => 'Arrest Logs',
        'data_overview_display' => 'table',
        'data_entry_display' => 'detailed',
        'database_structure' => [],
        'created_by' => $leader->id,
    ]);

    // Create Entry
    $entry = FactionRecordEntry::create([
        'database_id' => $recordDb->id,
        'entry_id' => 101,
        'data' => ['charge' => 'Speeding'],
        'is_active' => true,
        'created_by' => $leader->id,
    ]);

    // Create Dataset linked to this Database
    $dataset = RosterDataset::create([
        'faction_id' => $faction->id,
        'name' => 'Database Linked Dataset',
        'record_database_id' => $recordDb->id,
    ]);

    // Force delete (hard delete) the Record Database to trigger SQL constraints
    $recordDb->forceDelete();

    // Assert Record Database is deleted
    $this->assertDatabaseMissing('faction_record_databases', ['id' => $recordDb->id]);

    // Assert entries are cascade deleted
    $this->assertDatabaseMissing('faction_record_entries', ['id' => $entry->id]);

    // Assert dataset record_database_id link is set to null (nullOnDelete)
    $this->assertDatabaseHas('roster_datasets', [
        'id' => $dataset->id,
        'record_database_id' => null,
    ]);
});
