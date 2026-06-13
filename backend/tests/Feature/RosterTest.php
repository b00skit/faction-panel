<?php

use App\Events\RosterUpdated;
use App\Models\Faction;
use App\Models\Roster;
use App\Models\RosterContent;
use App\Models\RosterPermission;
use App\Models\RosterSection;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    $this->user = User::factory()->create(['is_superadmin' => true]);
    $this->faction = Faction::factory()->create();
    $this->user->factions()->attach($this->faction->id);
});

test('can create a roster', function () {
    $response = $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/rosters", [
            'name' => 'Patrol Division',
            'shortname' => 'PATROL',
            'color' => '#3b82f6',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('name', 'Patrol Division');

    $this->assertDatabaseHas('rosters', [
        'name' => 'Patrol Division',
        'shortname' => 'PATROL',
        'faction_id' => $this->faction->id,
    ]);

    // Check that a master section was automatically created
    $roster = Roster::where('shortname', 'PATROL')->first();
    $this->assertDatabaseHas('roster_sections', [
        'roster_id' => $roster->id,
        'name' => 'Main Section',
        'type' => 'master',
    ]);
});

test('can update a roster', function () {
    $roster = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'Initial Name',
        'shortname' => 'INIT',
        'color' => '#ffffff',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->putJson("/api/rosters/{$roster->id}", [
            'name' => 'Updated Name',
            'color' => '#123456',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('name', 'Updated Name')
        ->assertJsonPath('color', '#123456');

    $this->assertDatabaseHas('rosters', [
        'id' => $roster->id,
        'name' => 'Updated Name',
        'color' => '#123456',
    ]);
});

test('can delete a roster', function () {
    $roster = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'To Delete',
        'shortname' => 'DEL',
        'color' => '#ffffff',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->deleteJson("/api/rosters/{$roster->id}");

    $response->assertStatus(200);
    $this->assertSoftDeleted('rosters', ['id' => $roster->id]);
});

test('can create a roster section', function () {
    $roster = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'Roster',
        'shortname' => 'ROST',
        'color' => '#ffffff',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->postJson("/api/rosters/{$roster->id}/sections", [
            'name' => 'Platoon A',
            'shortname' => 'PLTA',
            'type' => 'section',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('name', 'Platoon A');

    $this->assertDatabaseHas('roster_sections', [
        'roster_id' => $roster->id,
        'name' => 'Platoon A',
        'shortname' => 'PLTA',
        'type' => 'section',
    ]);
});

test('can create and update roster content', function () {
    $roster = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'Roster',
        'shortname' => 'ROST',
        'color' => '#ffffff',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    $section = RosterSection::create([
        'roster_id' => $roster->id,
        'name' => 'Section',
        'shortname' => 'SEC',
        'type' => 'section',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    // Create content
    $response = $this->actingAs($this->user)
        ->postJson("/api/sections/{$section->id}/contents", [
            'type' => 'predefined',
            'content' => ['name' => 'John Doe', 'rank' => 'Officer'],
        ]);

    $response->assertStatus(201);
    $contentId = $response->json('id');

    $this->assertDatabaseHas('roster_contents', [
        'id' => $contentId,
        'type' => 'predefined',
    ]);

    // Update content
    $responseUpdate = $this->actingAs($this->user)
        ->putJson("/api/contents/{$contentId}", [
            'content' => ['name' => 'John Doe', 'rank' => 'Sergeant'],
            'force' => true,
        ]);

    $responseUpdate->assertStatus(200);

    // Refresh model to check JSON content field properly
    $content = RosterContent::find($contentId);
    expect($content->content['rank'])->toBe('Sergeant');
});

test('can lock and unlock roster content', function () {
    $roster = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'Roster',
        'shortname' => 'ROST',
        'color' => '#ffffff',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    $section = RosterSection::create([
        'roster_id' => $roster->id,
        'name' => 'Section',
        'shortname' => 'SEC',
        'type' => 'section',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    $content = RosterContent::create([
        'section_id' => $section->id,
        'type' => 'predefined',
        'content' => ['name' => 'John Doe'],
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    // Lock
    $this->actingAs($this->user)
        ->postJson("/api/contents/{$content->id}/lock", ['col_id' => 'name'])
        ->assertStatus(200);

    $content->refresh();
    expect($content->editing_by)->toBe($this->user->id);
    expect($content->editing_col)->toBe('name');

    // Unlock
    $this->actingAs($this->user)
        ->postJson("/api/contents/{$content->id}/unlock")
        ->assertStatus(200);

    $content->refresh();
    expect($content->editing_by)->toBeNull();
});

test('non-member cannot modify roster', function () {
    $roster = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'Roster',
        'shortname' => 'ROST',
        'color' => '#ffffff',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    $nonMember = User::factory()->create();

    $this->actingAs($nonMember)
        ->putJson("/api/rosters/{$roster->id}", [
            'name' => 'Unauthorized Edit',
        ])
        ->assertStatus(403);
});

test('updating roster permissions dispatches RosterUpdated event', function () {
    Event::fake([RosterUpdated::class]);

    $roster = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'Roster',
        'shortname' => 'ROST',
        'color' => '#ffffff',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    // Create a roster permission which should trigger saved event
    $rosterPermission = RosterPermission::create([
        'roster_id' => $roster->id,
        'role_id' => null,
        'group_id' => null,
        'permissions' => ['view_roster' => 'YES'],
    ]);

    Event::assertDispatched(RosterUpdated::class, function ($event) use ($roster) {
        return $event->roster->id === $roster->id;
    });

    Event::fake([RosterUpdated::class]); // reset fake for delete test

    $rosterPermission->delete();

    Event::assertDispatched(RosterUpdated::class, function ($event) use ($roster) {
        return $event->roster->id === $roster->id;
    });
});
