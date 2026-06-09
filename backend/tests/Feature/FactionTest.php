<?php

use App\Models\Faction;
use App\Models\User;

test('authenticated user can create a faction', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->postJson('/api/factions', [
        'name' => 'Test Faction',
        'shortname' => 'test-fac',
        'color' => '#FF0000',
        'visibility' => 'public',
        'access' => 'invite-only',
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('name', 'Test Faction')
        ->assertJsonPath('shortname', 'test-fac');

    $this->assertDatabaseHas('factions', ['shortname' => 'test-fac']);

    // Check default roles were created
    $faction = Faction::where('shortname', 'test-fac')->first();
    expect($faction->roles()->count())->toBe(3);
    expect($user->roles()->where('faction_id', $faction->id)->count())->toBe(1);
});

test('faction shortname must be unique', function () {
    $user = User::factory()->create();
    Faction::factory()->create(['shortname' => 'existing']);

    $response = $this->actingAs($user)->postJson('/api/factions', [
        'name' => 'New Name',
        'shortname' => 'existing',
        'color' => '#00FF00',
        'visibility' => 'public',
        'access' => 'invite-only',
    ]);

    $response->assertStatus(422);
});

test('user can join a faction', function () {
    $user = User::factory()->create();
    $creator = User::factory()->create();
    $faction = Faction::factory()->create([
        'shortname' => 'join-me',
        'faction_leader' => $creator->id,
        'created_by' => $creator->id,
        'access' => 'joinable',
    ]);

    $response = $this->actingAs($user)->postJson('/api/factions/join', [
        'shortname' => 'join-me',
    ]);

    $response->assertStatus(200);
    expect($faction->users()->where('user_id', $user->id)->exists())->toBeTrue();
});

test('unauthorized user cannot view a faction they are not in', function () {
    $user = User::factory()->create();
    $faction = Faction::factory()->create(['shortname' => 'private']);

    $response = $this->actingAs($user)->getJson('/api/factions/private');

    $response->assertStatus(403);
});

test('authorized user can fetch faction users list and search case-insensitively', function () {
    $leader = User::factory()->create(['username' => 'TheLeader']);
    $faction = Faction::factory()->create([
        'shortname' => 'lssd',
        'faction_leader' => $leader->id,
        'created_by' => $leader->id,
        'access' => 'private',
    ]);
    $faction->users()->attach($leader->id);

    $user1 = User::factory()->create(['username' => 'John_Doe', 'gtaw_username' => 'JohnDoeGTAW']);
    $user2 = User::factory()->create(['username' => 'Jane_Smith', 'gtaw_username' => 'JaneSmithGTAW']);

    $faction->users()->attach($user1->id);
    $faction->users()->attach($user2->id);

    // 1. Test fetching list
    $response = $this->actingAs($leader)->getJson('/api/factions/lssd/users');
    $response->assertStatus(200);
    $data = $response->json();

    // Should contain the users
    $usernames = collect($data)->pluck('username')->toArray();
    expect($usernames)->toContain('TheLeader')
        ->toContain('John_Doe')
        ->toContain('Jane_Smith');

    // 2. Test searching case-insensitively by username
    $responseSearch = $this->actingAs($leader)->getJson('/api/factions/lssd/users?search=john');
    $responseSearch->assertStatus(200);
    $searchData = $responseSearch->json();
    expect(count($searchData))->toBe(1);
    expect($searchData[0]['username'])->toBe('John_Doe');

    // 3. Test searching case-insensitively by gtaw_username
    $responseSearchGtaw = $this->actingAs($leader)->getJson('/api/factions/lssd/users?search=smithgtaw');
    $responseSearchGtaw->assertStatus(200);
    $searchDataGtaw = $responseSearchGtaw->json();
    expect(count($searchDataGtaw))->toBe(1);
    expect($searchDataGtaw[0]['username'])->toBe('Jane_Smith');
});
