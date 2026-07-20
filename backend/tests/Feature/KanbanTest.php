<?php

use App\Events\KanbanBoardUpdated;
use App\Models\Faction;
use App\Models\KanbanCard;
use App\Models\KanbanCardType;
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
