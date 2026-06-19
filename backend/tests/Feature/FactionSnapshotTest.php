<?php

use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Models\FactionRecordDatabasePermission;
use App\Models\FactionRecordEntry;
use App\Models\FactionSnapshot;
use App\Models\Form;
use App\Models\FormAutomation;
use App\Models\FormField;
use App\Models\FormPermission;
use App\Models\FormSection;
use App\Models\FormStage;
use App\Models\FormStatus;
use App\Models\Group;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Roster;
use App\Models\RosterContent;
use App\Models\RosterDataset;
use App\Models\RosterDatasetOption;
use App\Models\RosterFlag;
use App\Models\RosterPermission;
use App\Models\RosterSection;
use App\Models\StatisticsModel;
use App\Models\StatisticsPermission;
use App\Models\StatisticsWidget;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->user = User::factory()->create(['is_superadmin' => true]);
    $this->faction = Faction::factory()->create([
        'name' => 'Los Santos Sheriff Department',
        'shortname' => 'lssd',
    ]);
    $this->user->factions()->attach($this->faction->id);
});

test('can capture snapshot and restore it 1:1 with complex relations and ID mappings', function () {
    // 1. Arrange - Setup all complex configuration relations on the faction
    $faction = $this->faction;

    // Role & Permission
    $role = Role::create([
        'faction_id' => $faction->id,
        'name' => 'Deputy',
        'weight' => 10,
        'color' => '#00ff00',
        'type' => 'standard',
    ]);
    Permission::create([
        'role_id' => $role->id,
        'permission_key' => 'edit_roster',
        'value' => 'YES',
    ]);

    // Group
    $group = Group::create([
        'faction_id' => $faction->id,
        'name' => 'Patrol Division',
        'color' => '#ffffff',
        'created_by' => $this->user->id,
    ]);

    // Roster Flag
    $flag = RosterFlag::create([
        'faction_id' => $faction->id,
        'name' => 'LOA',
        'color' => '#ff0000',
        'rules' => [],
        'created_by' => $this->user->id,
    ]);

    // Dataset & Options
    $dataset = RosterDataset::create([
        'faction_id' => $faction->id,
        'name' => 'Ranks',
        'type' => 'select',
        'created_by' => $this->user->id,
    ]);
    $option = RosterDatasetOption::create([
        'roster_dataset_id' => $dataset->id,
        'value' => 'Deputy I',
        'order' => 1,
    ]);

    // Record Database & Entry & Permission
    $db = FactionRecordDatabase::create([
        'faction_id' => $faction->id,
        'name' => 'Disciplinary Records',
        'description' => 'IA logs',
        'database_structure' => [],
        'created_by' => $this->user->id,
    ]);
    $dbEntry = FactionRecordEntry::create([
        'database_id' => $db->id,
        'entry_id' => 1,
        'data' => ['officer' => 'John Doe'],
        'created_by' => $this->user->id,
    ]);
    $dbPerm = FactionRecordDatabasePermission::create([
        'database_id' => $db->id,
        'role_id' => $role->id,
        'group_id' => $group->id,
        'permissions' => ['view' => true],
    ]);

    // Roster & Section & Content & Permission
    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'Active Roster',
        'shortname' => 'active',
        'color' => '#ffffff',
        'columns' => [
            ['name' => 'Rank', 'dataset_id' => $dataset->id],
        ],
        'created_by' => $this->user->id,
    ]);
    $rosterPerm = RosterPermission::create([
        'roster_id' => $roster->id,
        'role_id' => $role->id,
        'group_id' => $group->id,
        'permissions' => ['view' => true],
    ]);
    $section = RosterSection::create([
        'roster_id' => $roster->id,
        'name' => 'First Shift',
        'shortname' => 'first',
        'type' => 'section',
        'order' => 1,
        'created_by' => $this->user->id,
    ]);
    $content = RosterContent::create([
        'section_id' => $section->id,
        'order' => 1,
        'content' => ['Rank' => 'Deputy I'],
        'created_by' => $this->user->id,
    ]);

    // Statistics Model & Widget & Permission
    $statModel = StatisticsModel::create([
        'faction_id' => $faction->id,
        'name' => 'Roster Stats',
        'description' => 'IA and patrol stats',
        'created_by' => $this->user->id,
    ]);
    $widget = StatisticsWidget::create([
        'statistics_model_id' => $statModel->id,
        'name' => 'Active Counts',
        'type' => 'bar',
        'configuration' => [
            'mode' => 'series',
            'series' => [
                ['name' => 'Active', 'color' => '#3b82f6', 'formula' => 'roster_count(' . $roster->id . ')']
            ]
        ],
        'order' => 1,
        'width' => 6,
    ]);
    $statPerm = StatisticsPermission::create([
        'statistics_model_id' => $statModel->id,
        'role_id' => $role->id,
        'group_id' => $group->id,
        'permissions' => ['view' => true],
    ]);

    // Form & Stages & Statuses & Sections & Fields & Automations & Permissions & Links
    $form = Form::create([
        'faction_id' => $faction->id,
        'name' => 'Recruitment Application',
        'type' => 'quiz',
        'is_enabled' => true,
        'created_by' => $this->user->id,
    ]);

    $statusSubmitted = FormStatus::create([
        'form_id' => $form->id,
        'name' => 'Submitted',
        'system_key' => 'submitted',
        'order' => 1,
    ]);
    $statusPassed = FormStatus::create([
        'form_id' => $form->id,
        'name' => 'Passed',
        'is_passed' => true,
        'order' => 2,
    ]);

    $stage = FormStage::create([
        'form_id' => $form->id,
        'name' => 'Written Test',
        'submit_status_id' => $statusPassed->id,
        'order' => 1,
    ]);

    // Create a pivot status-stage link
    DB::table('form_status_stage')->insert([
        'form_status_id' => $statusPassed->id,
        'form_stage_id' => $stage->id,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $formSection = FormSection::create([
        'form_stage_id' => $stage->id,
        'name' => 'Section A',
        'order' => 1,
    ]);

    $field = FormField::create([
        'form_section_id' => $formSection->id,
        'type' => 'text',
        'label' => 'What is the law?',
        'name' => 'law_question',
        'points' => 10,
        'is_required' => true,
        'is_automatic_scored' => true,
        'correct_answer' => 'A',
    ]);

    $formPerm = FormPermission::create([
        'form_id' => $form->id,
        'role_id' => $role->id,
        'group_id' => $group->id,
        'permissions' => ['review' => true],
    ]);

    $automation = FormAutomation::create([
        'form_id' => $form->id,
        'name' => 'Auto Pass',
        'trigger' => 'on_stage_submit',
        'trigger_stage_id' => $stage->id,
        'action' => 'set_status',
        'action_status_id' => $statusPassed->id,
        'conditions' => [
            [
                'type' => 'field_points',
                'field_id' => $field->id,
                'operator' => 'gte',
                'value' => '10',
            ],
            [
                'type' => 'status',
                'operator' => 'equals',
                'value' => (string) $statusSubmitted->id,
            ],
        ],
        'is_enabled' => true,
        'order' => 1,
    ]);

    // 2. Act - Create the snapshot
    $response = $this->actingAs($this->user)->postJson("/api/factions/{$faction->shortname}/snapshots", [
        'name' => 'Backup 1.0',
        'description' => 'Full backup',
    ]);

    $response->assertStatus(200);
    $snapshotId = $response->json('id');
    $snapshot = FactionSnapshot::findOrFail($snapshotId);

    // Verify snapshot captures all tables
    $data = $snapshot->data;
    expect($data['roles'])->toHaveCount(1);
    expect($data['groups'])->toHaveCount(1);
    expect($data['flags'])->toHaveCount(1);
    expect($data['datasets'])->toHaveCount(1);
    expect($data['recordDatabases'])->toHaveCount(1);
    expect($data['rosters'])->toHaveCount(1);
    expect($data['statistics'])->toHaveCount(1);
    expect($data['forms'])->toHaveCount(1);

    // Verify detailed form snapshot capture
    $formSnapshot = $data['forms'][0];
    expect($formSnapshot['statuses'])->toHaveCount(2);
    expect($formSnapshot['stages'])->toHaveCount(1);
    expect($formSnapshot['stages'][0]['sections'])->toHaveCount(1);
    expect($formSnapshot['stages'][0]['sections'][0]['fields'])->toHaveCount(1);
    expect($formSnapshot['automations'])->toHaveCount(1);
    expect($formSnapshot['status_stage_links'])->toHaveCount(1);

    // 3. Act - Restore the snapshot (which wipes and recreates everything)
    $restoreResponse = $this->actingAs($this->user)->postJson("/api/snapshots/{$snapshot->id}/restore");
    $restoreResponse->assertStatus(200);

    // 4. Assert - Verify everything is restored cleanly and mapped correctly
    $faction->load(['roles.permissions', 'groups', 'rosterFlags', 'rosterDatasets.options', 'recordDatabases.entries', 'rosters.sections.contents', 'statisticsModels.widgets', 'forms.stages.sections.fields', 'forms.statuses', 'forms.automations']);

    // Roles & Permissions
    expect($faction->roles)->toHaveCount(1);
    $newRole = $faction->roles->first();
    expect($newRole->name)->toBe('Deputy');
    expect($newRole->permissions)->toHaveCount(1);
    expect($newRole->permissions->first()->permission_key)->toBe('edit_roster');

    // Groups
    expect($faction->groups)->toHaveCount(1);
    $newGroup = $faction->groups->first();
    expect($newGroup->name)->toBe('Patrol Division');

    // Roster Flags
    expect($faction->rosterFlags)->toHaveCount(1);
    expect($faction->rosterFlags->first()->name)->toBe('LOA');

    // Datasets
    expect($faction->rosterDatasets)->toHaveCount(1);
    $newDataset = $faction->rosterDatasets->first();
    expect($newDataset->name)->toBe('Ranks');
    expect($newDataset->options)->toHaveCount(1);
    expect($newDataset->options->first()->value)->toBe('Deputy I');

    // Record Databases, entries and permissions
    expect($faction->recordDatabases)->toHaveCount(1);
    $newDb = $faction->recordDatabases->first();
    expect($newDb->name)->toBe('Disciplinary Records');
    expect($newDb->entries)->toHaveCount(1);
    expect($newDb->entries->first()->data)->toBe(['officer' => 'John Doe']);

    $newDbPerm = FactionRecordDatabasePermission::where('database_id', $newDb->id)->first();
    expect($newDbPerm)->not->toBeNull();
    expect($newDbPerm->role_id)->toBe($newRole->id);
    expect($newDbPerm->group_id)->toBe($newGroup->id);

    // Rosters, sections, contents, and roster permissions
    expect($faction->rosters)->toHaveCount(1);
    $newRoster = $faction->rosters->first();
    expect($newRoster->name)->toBe('Active Roster');
    // Verify column mapping
    expect($newRoster->columns[0]['dataset_id'])->toBe($newDataset->id);

    $newRosterPerm = RosterPermission::where('roster_id', $newRoster->id)->first();
    expect($newRosterPerm)->not->toBeNull();
    expect($newRosterPerm->role_id)->toBe($newRole->id);
    expect($newRosterPerm->group_id)->toBe($newGroup->id);

    expect($newRoster->sections)->toHaveCount(1);
    $newSection = $newRoster->sections->first();
    expect($newSection->name)->toBe('First Shift');
    expect($newSection->contents)->toHaveCount(1);
    expect($newSection->contents->first()->content)->toBe(['Rank' => 'Deputy I']);

    // Statistics Models, widgets, permissions
    expect($faction->statisticsModels)->toHaveCount(1);
    $newStatModel = $faction->statisticsModels->first();
    expect($newStatModel->name)->toBe('Roster Stats');
    expect($newStatModel->widgets)->toHaveCount(1);
    expect($newStatModel->widgets->first()->name)->toBe('Active Counts');

    $newStatPerm = StatisticsPermission::where('statistics_model_id', $newStatModel->id)->first();
    expect($newStatPerm)->not->toBeNull();
    expect($newStatPerm->role_id)->toBe($newRole->id);
    expect($newStatPerm->group_id)->toBe($newGroup->id);

    // Forms
    expect($faction->forms)->toHaveCount(1);
    $newForm = $faction->forms->first();
    expect($newForm->name)->toBe('Recruitment Application');
    expect($newForm->statuses)->toHaveCount(2);

    $newStatusSubmitted = $newForm->statuses->where('system_key', 'submitted')->first();
    $newStatusPassed = $newForm->statuses->where('is_passed', true)->first();
    expect($newStatusSubmitted)->not->toBeNull();
    expect($newStatusPassed)->not->toBeNull();

    expect($newForm->stages)->toHaveCount(1);
    $newStage = $newForm->stages->first();
    expect($newStage->name)->toBe('Written Test');
    expect($newStage->submit_status_id)->toBe($newStatusPassed->id);

    // Form Sections and Fields
    expect($newStage->sections)->toHaveCount(1);
    $newFormSection = $newStage->sections->first();
    expect($newFormSection->name)->toBe('Section A');
    expect($newFormSection->fields)->toHaveCount(1);
    $newField = $newFormSection->fields->first();
    expect($newField->label)->toBe('What is the law?');

    // Status-Stage pivot linkage
    $pivotExists = DB::table('form_status_stage')
        ->where('form_status_id', $newStatusPassed->id)
        ->where('form_stage_id', $newStage->id)
        ->exists();
    expect($pivotExists)->toBeTrue();

    // Form permissions
    $newFormPerm = FormPermission::where('form_id', $newForm->id)->first();
    expect($newFormPerm)->not->toBeNull();
    expect($newFormPerm->role_id)->toBe($newRole->id);
    expect($newFormPerm->group_id)->toBe($newGroup->id);

    // Form Automations
    expect($newForm->automations)->toHaveCount(1);
    $newAutomation = $newForm->automations->first();
    expect($newAutomation->name)->toBe('Auto Pass');
    expect($newAutomation->trigger_stage_id)->toBe($newStage->id);
    expect($newAutomation->action_status_id)->toBe($newStatusPassed->id);

    // CRITICAL: Verify that the automation condition's field_id and value status_id were mapped!
    $conditions = $newAutomation->conditions;
    expect($conditions)->toHaveCount(2);

    $fieldPointsCond = collect($conditions)->firstWhere('type', 'field_points');
    expect($fieldPointsCond)->not->toBeNull();
    expect($fieldPointsCond['field_id'])->toBe($newField->id);

    $statusCond = collect($conditions)->firstWhere('type', 'status');
    expect($statusCond)->not->toBeNull();
    expect($statusCond['value'])->toBe((string) $newStatusSubmitted->id);
});

test('can restore older snapshot format missing forms or statistics gracefully without crash (backward compatibility)', function () {
    // 1. Arrange - Setup older snapshot data
    $oldData = [
        'faction' => [
            'name' => 'Old Backup Faction',
            'shortname' => 'lssd',
            'color' => '#ffffff',
        ],
        'roles' => [],
        'groups' => [],
        'flags' => [],
        'datasets' => [],
        'recordDatabases' => [],
        'rosters' => [],
        // forms and statistics are completely missing from the array!
    ];

    $snapshot = FactionSnapshot::create([
        'faction_id' => $this->faction->id,
        'name' => 'Old Format Backup',
        'description' => 'Missing new modules',
        'data' => $oldData,
        'type' => 'manual',
        'created_by' => $this->user->id,
    ]);

    // 2. Act - Restore
    $response = $this->actingAs($this->user)->postJson("/api/snapshots/{$snapshot->id}/restore");

    // 3. Assert
    $response->assertStatus(200);
    $this->faction->refresh();
    expect($this->faction->name)->toBe('Old Backup Faction');
});

test('can upload a snapshot JSON file', function () {
    $faction = $this->faction;

    $snapshotData = [
        'v' => 1,
        'name' => 'Uploaded Test Snapshot',
        'description' => 'Test description',
        'data' => [
            'faction' => [
                'name' => 'Uploaded Test Faction',
                'shortname' => 'lssd',
            ],
            'roles' => [],
            'groups' => [],
            'flags' => [],
            'datasets' => [],
            'recordDatabases' => [],
            'rosters' => [],
            'statistics' => [],
            'forms' => [],
        ],
    ];

    $file = UploadedFile::fake()->createWithContent(
        'snapshot.json',
        json_encode($snapshotData)
    );

    $response = $this->actingAs($this->user)->postJson("/api/factions/{$faction->shortname}/snapshots/upload", [
        'file' => $file,
    ]);

    $response->assertStatus(200);

    $snapshot = FactionSnapshot::where('faction_id', $faction->id)
        ->where('name', 'Uploaded Test Snapshot (Imported)')
        ->first();

    expect($snapshot)->not->toBeNull();
    expect($snapshot->data['faction']['name'])->toBe('Uploaded Test Faction');
});

test('uploading empty file returns validation error', function () {
    $faction = $this->faction;

    $file = UploadedFile::fake()->create(
        'snapshot.json',
        0 // 0 KB
    );

    $response = $this->actingAs($this->user)->postJson("/api/factions/{$faction->shortname}/snapshots/upload", [
        'file' => $file,
    ]);

    $response->assertStatus(422);
});

test('uploading a json object instead of file returns failed to upload error', function () {
    $faction = $this->faction;

    $response = $this->actingAs($this->user)->postJson("/api/factions/{$faction->shortname}/snapshots/upload", [
        'file' => [
            'name' => 'snapshot_lssd_2026-06-02.json',
            'size' => '0',
        ],
    ]);

    $response->assertStatus(422);
});

test('uploading a file exceeding size limit returns failed to upload error', function () {
    $faction = $this->faction;

    $file = new UploadedFile(
        tempnam(sys_get_temp_dir(), 'test'),
        'snapshot.json',
        'application/json',
        UPLOAD_ERR_INI_SIZE,
        true // test mode
    );

    $response = $this->actingAs($this->user)->postJson("/api/factions/{$faction->shortname}/snapshots/upload", [
        'file' => $file,
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors([
        'file' => 'The file failed to upload. This is usually because the file size exceeds the server upload limit (currently '.ini_get('upload_max_filesize').').',
    ]);
});
