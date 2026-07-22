<?php

use App\Events\KanbanBoardUpdated;
use App\Models\Faction;
use App\Models\KanbanCard;
use App\Models\KanbanCardType;
use App\Models\KanbanPriority;
use App\Models\KanbanLabel;
use App\Models\KanbanProject;
use App\Models\KanbanProjectPermission;
use App\Models\KanbanStatus;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    $this->user = User::factory()->create(['is_superadmin' => true]);
    $this->faction = Faction::factory()->create();
    $this->user->factions()->attach($this->faction->id);

    // Seed default card types
    $this->cardType = KanbanCardType::create([
        'name' => 'Task',
        'color' => '#3b82f6',
        'icon' => 'CheckSquare',
        'settings' => [
            'description' => true,
            'subtasks' => true,
            'color' => true,
            'icon' => true,
            'comments' => true,
            'assignee' => true,
            'priority' => true,
        ],
    ]);
});

test('can create a kanban project', function () {
    $response = $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/kanban/projects", [
            'name' => 'Web Development',
            'color' => '#3b82f6',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('name', 'Web Development');

    $this->assertDatabaseHas('kanban_projects', [
        'name' => 'Web Development',
        'color' => '#3b82f6',
        'faction_id' => $this->faction->id,
    ]);

    // Check that default columns were created
    $project = KanbanProject::where('name', 'Web Development')->first();
    $this->assertDatabaseHas('kanban_statuses', [
        'project_id' => $project->id,
        'name' => 'To Do',
    ]);
});

test('can update a project', function () {
    $project = KanbanProject::create([
        'faction_id' => $this->faction->id,
        'name' => 'Initial Project',
        'color' => '#ffffff',
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->putJson("/api/kanban/projects/{$project->id}", [
            'name' => 'Updated Project Name',
            'color' => '#ff0000',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('name', 'Updated Project Name');

    $this->assertDatabaseHas('kanban_projects', [
        'id' => $project->id,
        'name' => 'Updated Project Name',
        'color' => '#ff0000',
    ]);
});

test('can create and reorder columns', function () {
    $project = KanbanProject::create([
        'faction_id' => $this->faction->id,
        'name' => 'Columns Project',
        'created_by' => $this->user->id,
    ]);

    $status1 = KanbanStatus::create(['project_id' => $project->id, 'name' => 'Col 1', 'order' => 0]);
    $status2 = KanbanStatus::create(['project_id' => $project->id, 'name' => 'Col 2', 'order' => 1]);

    $response = $this->actingAs($this->user)
        ->putJson("/api/kanban/projects/{$project->id}/statuses/reorder", [
            'status_order' => [$status2->id, $status1->id],
        ]);

    $response->assertStatus(200);

    $this->assertEquals(0, $status2->fresh()->order);
    $this->assertEquals(1, $status1->fresh()->order);
});

test('can create a card, add subtask, and comment', function () {
    $project = KanbanProject::create([
        'faction_id' => $this->faction->id,
        'name' => 'Cards Project',
        'created_by' => $this->user->id,
    ]);

    $status = KanbanStatus::create(['project_id' => $project->id, 'name' => 'To Do', 'order' => 0]);

    // Create Card
    $response = $this->actingAs($this->user)
        ->postJson("/api/kanban/projects/{$project->id}/cards", [
            'title' => 'Implement Auth',
            'status_id' => $status->id,
            'card_type_id' => $this->cardType->id,
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('title', 'Implement Auth');

    $cardId = $response->json('id');

    // Add subtask
    $subtaskResponse = $this->actingAs($this->user)
        ->postJson("/api/kanban/cards/{$cardId}/subtasks", [
            'title' => 'Install Laravel Sanctum',
        ]);
    $subtaskResponse->assertStatus(201);
    $this->assertDatabaseHas('kanban_subtasks', [
        'card_id' => $cardId,
        'title' => 'Install Laravel Sanctum',
    ]);

    // Comment
    $commentResponse = $this->actingAs($this->user)
        ->postJson("/api/kanban/cards/{$cardId}/comments", [
            'comment' => 'This is a test comment',
        ]);
    $commentResponse->assertStatus(201);
    $this->assertDatabaseHas('kanban_comments', [
        'card_id' => $cardId,
        'comment' => 'This is a test comment',
    ]);
});

test('project permissions deny access for unauthorized users', function () {
    $project = KanbanProject::create([
        'faction_id' => $this->faction->id,
        'name' => 'Secret Project',
        'created_by' => $this->user->id,
    ]);

    $regularUser = User::factory()->create();
    $regularUser->factions()->attach($this->faction->id);

    // Limit view permissions on this project
    // Empty permissions means public has no access, and since regularUser has no roles/groups granted, they cannot view
    KanbanProjectPermission::create([
        'project_id' => $project->id,
        'group_id' => null,
        'role_id' => null,
        'permissions' => [], // public gets nothing
    ]);

    $response = $this->actingAs($regularUser)
        ->getJson("/api/factions/{$this->faction->shortname}/kanban/projects");

    // Secret project should not be in the list
    $response->assertStatus(200);
    $this->assertCount(0, $response->json());
});

test('can update a card type', function () {
    $response = $this->actingAs($this->user)
        ->putJson("/api/kanban/card-types/{$this->cardType->id}", [
            'name' => 'Updated Task',
            'color' => '#ef4444',
            'icon' => 'Flame',
            'settings' => [
                'description' => false,
                'subtasks' => true,
                'color' => true,
                'icon' => true,
                'comments' => false,
                'assignee' => true,
                'priority' => false,
            ],
            'shortname' => $this->faction->shortname,
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('name', 'Updated Task')
        ->assertJsonPath('color', '#ef4444')
        ->assertJsonPath('settings.description', false);

    $this->assertDatabaseHas('kanban_card_types', [
        'id' => $this->cardType->id,
        'name' => 'Updated Task',
        'color' => '#ef4444',
    ]);
});

test('can update a priority', function () {
    $priority = KanbanPriority::create([
        'name' => 'High',
        'color' => '#f97316',
        'icon' => 'ArrowUp',
        'order' => 2,
        'is_default' => false,
    ]);

    $response = $this->actingAs($this->user)
        ->putJson("/api/kanban/priorities/{$priority->id}", [
            'name' => 'Super High',
            'color' => '#ef4444',
            'icon' => 'Flame',
            'order' => 5,
            'is_default' => true,
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('name', 'Super High')
        ->assertJsonPath('is_default', true);

    $this->assertDatabaseHas('kanban_priorities', [
        'id' => $priority->id,
        'name' => 'Super High',
        'color' => '#ef4444',
        'order' => 5,
        'is_default' => true,
    ]);

    // Check that previous default (if any) was set to false
    // Since we only seeded one priority here, let's just make sure this one is default
    $this->assertTrue(KanbanPriority::find($priority->id)->is_default);
});

test('can create project with prefix and toggle show prefix settings', function () {
    $response = $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/kanban/projects", [
            'name' => 'Prefix Project',
            'color' => '#3b82f6',
            'prefix' => 'PRE',
            'show_prefix' => false,
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('prefix', 'PRE')
        ->assertJsonPath('show_prefix', false);

    $this->assertDatabaseHas('kanban_projects', [
        'name' => 'Prefix Project',
        'prefix' => 'PRE',
        'show_prefix' => false,
    ]);

    $project = KanbanProject::where('name', 'Prefix Project')->first();
    $updateResponse = $this->actingAs($this->user)
        ->putJson("/api/kanban/projects/{$project->id}", [
            'prefix' => 'UPD',
            'show_prefix' => true,
        ]);

    $updateResponse->assertStatus(200)
        ->assertJsonPath('prefix', 'UPD')
        ->assertJsonPath('show_prefix', true);

    $this->assertDatabaseHas('kanban_projects', [
        'id' => $project->id,
        'prefix' => 'UPD',
        'show_prefix' => true,
    ]);

    // Can access project endpoint using shortcode prefix instead of ID
    $prefixResponse = $this->actingAs($this->user)
        ->getJson("/api/kanban/projects/UPD/assignees");

    $prefixResponse->assertStatus(200);
});

test('can archive, restore and fetch archived cards', function () {
    $project = KanbanProject::create([
        'faction_id' => $this->faction->id,
        'name' => 'Archive Project',
        'created_by' => $this->user->id,
    ]);

    $status = KanbanStatus::create(['project_id' => $project->id, 'name' => 'To Do', 'order' => 0]);

    $card = KanbanCard::create([
        'project_id' => $project->id,
        'status_id' => $status->id,
        'card_type_id' => $this->cardType->id,
        'title' => 'Test Card to Archive',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    $this->assertFalse($card->is_archived);

    $response = $this->actingAs($this->user)
        ->postJson("/api/kanban/cards/{$card->id}/archive");

    $response->assertStatus(200);
    $this->assertTrue($card->fresh()->is_archived);

    $listResponse = $this->actingAs($this->user)
        ->getJson("/api/kanban/projects/{$project->id}/archived");

    $listResponse->assertStatus(200);
    $this->assertCount(1, $listResponse->json());
    $this->assertEquals('Test Card to Archive', $listResponse->json()[0]['title']);

    $restoreResponse = $this->actingAs($this->user)
        ->postJson("/api/kanban/cards/{$card->id}/restore");

    $restoreResponse->assertStatus(200);
    $this->assertFalse($card->fresh()->is_archived);

    $listResponseEmpty = $this->actingAs($this->user)
        ->getJson("/api/kanban/projects/{$project->id}/archived");

    $listResponseEmpty->assertStatus(200);
    $this->assertCount(0, $listResponseEmpty->json());
});

test('can fetch unified card activity feed', function () {
    $project = KanbanProject::create([
        'faction_id' => $this->faction->id,
        'name' => 'Activity Project',
        'created_by' => $this->user->id,
    ]);

    $status = KanbanStatus::create(['project_id' => $project->id, 'name' => 'To Do', 'order' => 0]);

    $card = KanbanCard::create([
        'project_id' => $project->id,
        'status_id' => $status->id,
        'card_type_id' => $this->cardType->id,
        'title' => 'Card Activity',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    $this->actingAs($this->user)
        ->postJson("/api/kanban/cards/{$card->id}/comments", [
            'comment' => 'Comment 1',
        ]);

    $this->actingAs($this->user)
        ->putJson("/api/kanban/cards/{$card->id}", [
            'title' => 'Updated Title Activity',
        ]);

    $response = $this->actingAs($this->user)
        ->getJson("/api/kanban/cards/{$card->id}/activity");

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data',
            'current_page',
            'per_page',
            'total',
            'last_page'
        ]);

    $data = $response->json('data');
    $this->assertGreaterThanOrEqual(2, count($data));
    $this->assertNotEmpty($data[0]['type']);
});

test('obfuscates comments and descriptions when user lacks view details permission', function () {
    $regularUser = User::factory()->create(['is_superadmin' => false]);
    $regularUser->factions()->attach($this->faction->id);

    $otherUser = User::factory()->create();
    $project = KanbanProject::create([
        'faction_id' => $this->faction->id,
        'name' => 'Restricted Project',
        'created_by' => $otherUser->id,
    ]);

    $status = KanbanStatus::create(['project_id' => $project->id, 'name' => 'To Do', 'order' => 0]);

    $card = KanbanCard::create([
        'project_id' => $project->id,
        'status_id' => $status->id,
        'card_type_id' => $this->cardType->id,
        'title' => 'Secret Card',
        'description' => 'Top secret description contents',
        'order' => 0,
        'created_by' => $otherUser->id,
    ]);

    $card->comments()->create([
        'user_id' => $otherUser->id,
        'comment' => 'Secret comment contents',
    ]);

    KanbanProjectPermission::create([
        'project_id' => $project->id,
        'role_id' => null,
        'group_id' => null,
        'permissions' => ['view_project'], // no view_card_details
    ]);

    // Log user in who has no direct override or moderator role, so they fall back to project view_project permission
    $response = $this->actingAs($regularUser)
        ->getJson("/api/factions/{$this->faction->shortname}/kanban/projects");

    $response->assertStatus(200);
    $projectsArray = $response->json();
    $proj = collect($projectsArray)->firstWhere('id', $project->id);

    $this->assertNotNull($proj);
    $this->assertFalse($proj['user_permissions']['view_card_details']);

    $cardData = $proj['statuses'][0]['cards'][0];
    
    // Description should be boolean true/false, not contents
    $this->assertTrue($cardData['description']); 

    // Comments should be integer/count, not the comment records array
    $this->assertEquals(1, $cardData['comments']);
});

test('can create and manage kanban rows and respects default status column protection', function () {
    $project = KanbanProject::create([
        'faction_id' => $this->faction->id,
        'name' => 'Project Row Board',
        'created_by' => $this->user->id,
        'enable_project_management' => true,
    ]);

    $defaultStatus = KanbanStatus::create([
        'project_id' => $project->id,
        'name' => 'To Do',
        'order' => 0,
        'is_visible' => true,
        'is_default' => true,
    ]);

    $defaultRow = \App\Models\KanbanRow::create([
        'project_id' => $project->id,
        'name' => 'Default Row',
        'order' => 0,
        'is_visible' => true,
        'is_default' => true,
    ]);

    // Attempting to delete default status column should fail with 422
    $deleteStatusResponse = $this->actingAs($this->user)
        ->deleteJson("/api/kanban/statuses/{$defaultStatus->id}");
    $deleteStatusResponse->assertStatus(422);

    // Attempting to hide default status column should fail with 422
    $hideStatusResponse = $this->actingAs($this->user)
        ->putJson("/api/kanban/statuses/{$defaultStatus->id}", ['is_visible' => false]);
    $hideStatusResponse->assertStatus(422);

    // Create custom Kanban Row
    $rowResponse = $this->actingAs($this->user)
        ->postJson("/api/kanban/projects/{$project->id}/rows", [
            'name' => 'Invisible Backlog Row',
            'is_visible' => false,
        ]);
    $rowResponse->assertStatus(201)
        ->assertJsonPath('name', 'Invisible Backlog Row')
        ->assertJsonPath('is_visible', false);

    $rowId = $rowResponse->json('id');

    // Toggle row visibility
    $toggleResponse = $this->actingAs($this->user)
        ->putJson("/api/kanban/rows/{$rowId}", [
            'is_visible' => true,
        ]);
    $toggleResponse->assertStatus(200)
        ->assertJsonPath('is_visible', true);

    // Attempt to delete default row should fail with 422
    $deleteRowResponse = $this->actingAs($this->user)
        ->deleteJson("/api/kanban/rows/{$defaultRow->id}");
    $deleteRowResponse->assertStatus(422);

    // Delete custom row should succeed
    $deleteCustomRow = $this->actingAs($this->user)
        ->deleteJson("/api/kanban/rows/{$rowId}");
    $deleteCustomRow->assertStatus(200);
});

test('cards receive independent per-project count values', function () {
    $project1 = KanbanProject::create([
        'faction_id' => $this->faction->id,
        'name' => 'Project Alpha',
        'created_by' => $this->user->id,
    ]);
    $status1 = KanbanStatus::create(['project_id' => $project1->id, 'name' => 'To Do', 'order' => 0]);

    $project2 = KanbanProject::create([
        'faction_id' => $this->faction->id,
        'name' => 'Project Beta',
        'created_by' => $this->user->id,
    ]);
    $status2 = KanbanStatus::create(['project_id' => $project2->id, 'name' => 'To Do', 'order' => 0]);

    $card1 = KanbanCard::create([
        'project_id' => $project1->id,
        'status_id' => $status1->id,
        'card_type_id' => $this->cardType->id,
        'title' => 'Alpha Card 1',
    ]);

    $card2 = KanbanCard::create([
        'project_id' => $project2->id,
        'status_id' => $status2->id,
        'card_type_id' => $this->cardType->id,
        'title' => 'Beta Card 1',
    ]);

    $card3 = KanbanCard::create([
        'project_id' => $project1->id,
        'status_id' => $status1->id,
        'card_type_id' => $this->cardType->id,
        'title' => 'Alpha Card 2',
    ]);

    expect($card1->count)->toBe(1);
    expect($card2->count)->toBe(1);
    expect($card3->count)->toBe(2);
});



