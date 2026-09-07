<?php

use App\Models\Faction;
use App\Models\KanbanHtmlCard;
use App\Models\KanbanProject;
use App\Models\KanbanStatus;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create(['is_superadmin' => true]);
    $this->faction = Faction::factory()->create();
    $this->user->factions()->attach($this->faction->id);

    // Create a project
    $this->project = KanbanProject::create([
        'faction_id' => $this->faction->id,
        'name' => 'Test Project',
        'color' => '#3b82f6',
        'created_by' => $this->user->id,
    ]);

    $this->status = KanbanStatus::create([
        'project_id' => $this->project->id,
        'name' => 'To Do',
        'order' => 0,
    ]);
});

test('can create an html card', function () {
    $response = $this->actingAs($this->user)
        ->postJson("/api/kanban/projects/{$this->project->id}/html-cards", [
            'name' => 'Important Notice',
            'status_id' => $this->status->id,
            'content' => '<h1>Read This First</h1><p>Rules of the sprint</p>',
            'position' => 'top',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('name', 'Important Notice')
        ->assertJsonPath('position', 'top')
        ->assertJsonPath('content', '<h1>Read This First</h1><p>Rules of the sprint</p>');

    $this->assertDatabaseHas('kanban_html_cards', [
        'project_id' => $this->project->id,
        'status_id' => $this->status->id,
        'name' => 'Important Notice',
        'position' => 'top',
    ]);
});

test('can list html cards for project', function () {
    KanbanHtmlCard::create([
        'project_id' => $this->project->id,
        'status_id' => $this->status->id,
        'name' => 'Banner 1',
        'content' => '<div>Notice</div>',
        'position' => 'top',
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->getJson("/api/kanban/projects/{$this->project->id}/html-cards");

    $response->assertStatus(200)
        ->assertJsonCount(1)
        ->assertJsonPath('0.name', 'Banner 1');
});

test('can update an html card', function () {
    $card = KanbanHtmlCard::create([
        'project_id' => $this->project->id,
        'status_id' => $this->status->id,
        'name' => 'Old Title',
        'content' => '<p>Old</p>',
        'position' => 'top',
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->putJson("/api/kanban/html-cards/{$card->id}", [
            'name' => 'New Title',
            'content' => '<p>Updated content</p>',
            'position' => 'bottom',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('name', 'New Title')
        ->assertJsonPath('position', 'bottom')
        ->assertJsonPath('content', '<p>Updated content</p>');

    $this->assertDatabaseHas('kanban_html_cards', [
        'id' => $card->id,
        'name' => 'New Title',
        'position' => 'bottom',
    ]);
});

test('can delete an html card', function () {
    $card = KanbanHtmlCard::create([
        'project_id' => $this->project->id,
        'status_id' => $this->status->id,
        'name' => 'To Delete',
        'content' => '<p>Delete me</p>',
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->deleteJson("/api/kanban/html-cards/{$card->id}");

    $response->assertStatus(200);

    $this->assertSoftDeleted('kanban_html_cards', [
        'id' => $card->id,
    ]);
});

test('html cards are included in project list response', function () {
    KanbanHtmlCard::create([
        'project_id' => $this->project->id,
        'status_id' => $this->status->id,
        'name' => 'Project Card',
        'content' => '<p>Content</p>',
        'position' => 'top',
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->getJson("/api/factions/{$this->faction->shortname}/kanban/projects");

    $response->assertStatus(200);
    $projects = $response->json();
    expect($projects[0]['html_cards'])->toHaveCount(1);
    expect($projects[0]['html_cards'][0]['name'])->toBe('Project Card');
});

test('unauthorized user cannot create html card', function () {
    $regularUser = User::factory()->create(['is_superadmin' => false]);
    $regularUser->factions()->attach($this->faction->id);

    $response = $this->actingAs($regularUser)
        ->postJson("/api/kanban/projects/{$this->project->id}/html-cards", [
            'name' => 'Unauthorized Card',
            'status_id' => $this->status->id,
            'content' => '<p>Test</p>',
        ]);

    $response->assertStatus(403);
});
