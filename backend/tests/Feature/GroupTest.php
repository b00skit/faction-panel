<?php

use App\Models\Faction;
use App\Models\Group;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create(['is_superadmin' => true]);
    $this->faction = Faction::factory()->create();
    $this->user->factions()->attach($this->faction->id);
});

test('can create a group', function () {
    $response = $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/groups", [
            'name' => 'Tactical Unit',
            'color' => '#FF5733',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('name', 'Tactical Unit');

    $this->assertDatabaseHas('groups', [
        'name' => 'Tactical Unit',
        'color' => '#FF5733',
        'faction_id' => $this->faction->id,
    ]);
});

test('can update a group', function () {
    $group = Group::create([
        'faction_id' => $this->faction->id,
        'name' => 'Original Group',
        'color' => '#000000',
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->putJson("/api/groups/{$group->id}", [
            'name' => 'Updated Group',
            'color' => '#ffffff',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('name', 'Updated Group')
        ->assertJsonPath('color', '#ffffff');

    $this->assertDatabaseHas('groups', [
        'id' => $group->id,
        'name' => 'Updated Group',
        'color' => '#ffffff',
    ]);
});

test('can delete a group', function () {
    $group = Group::create([
        'faction_id' => $this->faction->id,
        'name' => 'To Delete',
        'color' => '#000000',
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->deleteJson("/api/groups/{$group->id}");

    $response->assertStatus(200);
    $this->assertSoftDeleted('groups', ['id' => $group->id]);
});

test('can add and remove group member', function () {
    $group = Group::create([
        'faction_id' => $this->faction->id,
        'name' => 'Group A',
        'color' => '#000000',
        'created_by' => $this->user->id,
    ]);

    $targetUser = User::factory()->create();
    $targetUser->factions()->attach($this->faction->id);

    // Add member
    $responseAdd = $this->actingAs($this->user)
        ->postJson("/api/groups/{$group->id}/members", [
            'user_id' => $targetUser->id,
            'is_leader' => false,
        ]);

    $responseAdd->assertStatus(200);
    expect($group->members()->where('user_id', $targetUser->id)->exists())->toBeTrue();

    // Remove member
    $responseRemove = $this->actingAs($this->user)
        ->deleteJson("/api/groups/{$group->id}/members/{$targetUser->id}");

    $responseRemove->assertStatus(200);
    expect($group->members()->where('user_id', $targetUser->id)->exists())->toBeFalse();
});

test('cannot add member not in faction', function () {
    $group = Group::create([
        'faction_id' => $this->faction->id,
        'name' => 'Group A',
        'color' => '#000000',
        'created_by' => $this->user->id,
    ]);

    $targetUser = User::factory()->create();
    // Do not attach to faction

    $response = $this->actingAs($this->user)
        ->postJson("/api/groups/{$group->id}/members", [
            'user_id' => $targetUser->id,
        ]);

    $response->assertStatus(422);
});

test('can toggle leader status', function () {
    $group = Group::create([
        'faction_id' => $this->faction->id,
        'name' => 'Group A',
        'color' => '#000000',
        'created_by' => $this->user->id,
    ]);

    $targetUser = User::factory()->create();
    $targetUser->factions()->attach($this->faction->id);
    $group->members()->attach($targetUser->id, ['is_leader' => false]);

    $response = $this->actingAs($this->user)
        ->putJson("/api/groups/{$group->id}/members/{$targetUser->id}/toggle-leader");

    $response->assertStatus(200);
    $memberPivot = $group->members()->where('user_id', $targetUser->id)->first();
    expect((bool) $memberPivot->pivot->is_leader)->toBeTrue();
});

test('regular faction member can list groups', function () {
    $regularUser = User::factory()->create(['is_superadmin' => false]);
    $regularUser->factions()->attach($this->faction->id);

    Group::create([
        'faction_id' => $this->faction->id,
        'name' => 'Patrol Division',
        'color' => '#00FF00',
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($regularUser)
        ->getJson("/api/factions/{$this->faction->shortname}/groups");

    $response->assertStatus(200)
        ->assertJsonFragment(['name' => 'Patrol Division']);
});

