<?php

use App\Models\Faction;
use App\Models\Role;
use App\Models\Roster;
use App\Models\User;
use App\Models\RosterExclusion;

test('users with excluded role are denied access even with global permissions', function () {
    $faction = Faction::factory()->create();
    
    // Faction owner/leader
    $leader = User::factory()->create();
    $faction->update(['faction_leader' => $leader->id]);
    
    // Normal user
    $user = User::factory()->create();
    $faction->users()->attach($user->id);
    
    // Create roster
    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'Test Roster',
        'shortname' => 'TEST',
        'color' => '#ffffff',
        'order' => 0,
    ]);
    
    // Create role and assign to user
    $role = Role::create(['faction_id' => $faction->id, 'name' => 'Officer']);
    $user->roles()->attach($role->id);
    
    // Grant global roster moderation to role
    $role->permissions()->create(['permission_key' => 'global_roster_moderation', 'value' => 'YES']);
    
    // Clear cache first
    User::clearPermissionsCache();
    
    // Before exclusion: user has access because of global_roster_moderation
    expect(User::hasRosterPermission($user, $roster, 'view_roster'))->toBeTrue();
    expect(User::canViewRoster($user, $roster))->toBeTrue();
    
    // Exclude the Officer role
    RosterExclusion::create([
        'roster_id' => $roster->id,
        'role_id' => $role->id,
    ]);
    
    // Clear cache
    User::clearPermissionsCache();
    
    // After exclusion: user should be denied access
    expect(User::hasRosterPermission($user, $roster, 'view_roster'))->toBeFalse();
    expect(User::canViewRoster($user, $roster))->toBeFalse();
});

test('faction owner is exempt from role exclusion', function () {
    $faction = Faction::factory()->create();
    
    // Faction owner/leader
    $leader = User::factory()->create();
    $faction->update(['faction_leader' => $leader->id]);
    
    // Create roster
    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'Test Roster',
        'shortname' => 'TEST',
        'color' => '#ffffff',
        'order' => 0,
    ]);
    
    // Create role and assign to leader
    $role = Role::create(['faction_id' => $faction->id, 'name' => 'LeaderRole']);
    $leader->roles()->attach($role->id);
    
    // Exclude the role
    RosterExclusion::create([
        'roster_id' => $roster->id,
        'role_id' => $role->id,
    ]);
    
    // Clear cache
    User::clearPermissionsCache();
    
    // Leader is faction owner, so still has access
    expect(User::hasRosterPermission($leader, $roster, 'view_roster'))->toBeTrue();
    expect(User::canViewRoster($leader, $roster))->toBeTrue();
});

test('exclusions API endpoints work correctly', function () {
    $faction = Faction::factory()->create();
    
    $leader = User::factory()->create();
    $faction->update(['faction_leader' => $leader->id]);
    $faction->users()->attach($leader->id);
    
    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'Test Roster',
        'shortname' => 'TEST',
        'color' => '#ffffff',
        'order' => 0,
    ]);
    
    $role = Role::create(['faction_id' => $faction->id, 'name' => 'Officer']);
    
    // Authenticate as leader
    $response = $this->actingAs($leader)->postJson("/api/rosters/{$roster->id}/exclusions", [
        'role_id' => $role->id,
    ]);
    
    $response->assertStatus(200);
    $response->assertJsonFragment(['role_id' => $role->id]);
    
    // Get exclusions
    $getResponse = $this->actingAs($leader)->getJson("/api/rosters/{$roster->id}/exclusions");
    $getResponse->assertStatus(200);
    $getResponse->assertJsonCount(1);
    
    // Remove exclusion
    $deleteResponse = $this->actingAs($leader)->deleteJson("/api/rosters/{$roster->id}/exclusions/{$role->id}");
    $deleteResponse->assertStatus(200);
    
    // Get exclusions again
    $getResponseAfter = $this->actingAs($leader)->getJson("/api/rosters/{$roster->id}/exclusions");
    $getResponseAfter->assertStatus(200);
    $getResponseAfter->assertJsonCount(0);
});
