<?php

use App\Models\Faction;
use App\Models\Role;
use App\Models\Roster;
use App\Models\User;

test('roster with no permissions is visible to the owner', function () {
    $faction = Faction::factory()->create();

    $owner = User::factory()->create();
    $faction->users()->attach($owner->id);

    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'No Perms Roster',
        'shortname' => 'NOPERM',
        'color' => '#ffffff',
        'order' => 0,
        'created_by' => $owner->id,
    ]);

    User::clearPermissionsCache();

    expect(User::canViewRoster($owner, $roster))->toBeTrue();
});

test('roster with no permissions is visible to the faction owner (leader)', function () {
    $faction = Faction::factory()->create();

    $leader = User::factory()->create();
    $faction->update(['faction_leader' => $leader->id]);

    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'No Perms Roster',
        'shortname' => 'NOPERM',
        'color' => '#ffffff',
        'order' => 0,
        'created_by' => User::factory()->create()->id, // created by someone else
    ]);

    User::clearPermissionsCache();

    expect(User::canViewRoster($leader, $roster))->toBeTrue();
});

test('roster with no permissions is visible to the roster master (global_roster_moderation)', function () {
    $faction = Faction::factory()->create();

    $moderator = User::factory()->create();
    $faction->users()->attach($moderator->id);

    $role = Role::create(['faction_id' => $faction->id, 'name' => 'Moderator Role']);
    $moderator->roles()->attach($role->id);
    $role->permissions()->create(['permission_key' => 'global_roster_moderation', 'value' => 'YES']);

    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'No Perms Roster',
        'shortname' => 'NOPERM',
        'color' => '#ffffff',
        'order' => 0,
        'created_by' => User::factory()->create()->id,
    ]);

    User::clearPermissionsCache();

    expect(User::canViewRoster($moderator, $roster))->toBeTrue();
});

test('roster with no permissions is visible to superadmin', function () {
    $faction = Faction::factory()->create();

    $superadmin = User::factory()->create(['is_superadmin' => true]);

    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'No Perms Roster',
        'shortname' => 'NOPERM',
        'color' => '#ffffff',
        'order' => 0,
        'created_by' => User::factory()->create()->id,
    ]);

    User::clearPermissionsCache();

    expect(User::canViewRoster($superadmin, $roster))->toBeTrue();
});

test('roster with no permissions is NOT visible to regular members even with view_faction_roster', function () {
    $faction = Faction::factory()->create();

    $member = User::factory()->create();
    $faction->users()->attach($member->id);

    $role = Role::create(['faction_id' => $faction->id, 'name' => 'Member Role']);
    $member->roles()->attach($role->id);
    $role->permissions()->create(['permission_key' => 'view_faction_roster', 'value' => 'YES']);

    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'No Perms Roster',
        'shortname' => 'NOPERM',
        'color' => '#ffffff',
        'order' => 0,
        'created_by' => User::factory()->create()->id,
    ]);

    User::clearPermissionsCache();

    expect(User::canViewRoster($member, $roster))->toBeFalse();
});

test('roster with explicit permissions is visible to regular members with view_roster permission', function () {
    $faction = Faction::factory()->create();

    $member = User::factory()->create();
    $faction->users()->attach($member->id);

    $role = Role::create(['faction_id' => $faction->id, 'name' => 'Member Role']);
    $member->roles()->attach($role->id);

    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'Explicit Perms Roster',
        'shortname' => 'EXPLIC',
        'color' => '#ffffff',
        'order' => 0,
        'created_by' => User::factory()->create()->id,
    ]);

    // Grant view_roster explicit permission
    $roster->rosterPermissions()->create([
        'role_id' => $role->id,
        'permissions' => ['view_roster'],
    ]);

    User::clearPermissionsCache();

    expect(User::canViewRoster($member, $roster))->toBeTrue();
});
