<?php

use App\Models\AuditLog;
use App\Models\Faction;
use App\Models\Roster;
use App\Models\RosterRevision;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

beforeEach(function () {
    $this->leader = User::factory()->create();
    $this->user = User::factory()->create();
    $this->otherUser = User::factory()->create();

    $this->faction = Faction::factory()->create([
        'faction_leader' => $this->leader->id,
        'created_by' => $this->leader->id,
        'shortname' => 'lssd',
        'visibility' => 'public',
        'access' => 'invite-only',
    ]);

    $this->faction->users()->attach($this->user->id);
    $this->faction->users()->attach($this->otherUser->id);

    // Setup roles
    $this->userRole = $this->faction->roles()->create([
        'name' => 'User',
        'weight' => 1,
        'color' => '#d1d5db',
        'type' => 'primary',
    ]);
    $this->userRole->permissions()->create(['permission_key' => 'utilize_sandbox_rosters', 'value' => 'YES']);
    $this->userRole->permissions()->create(['permission_key' => 'view_faction_roster', 'value' => 'YES']);
    $this->user->roles()->attach($this->userRole->id);

    $this->otherRole = $this->faction->roles()->create([
        'name' => 'Other User',
        'weight' => 2,
        'color' => '#d1d5db',
        'type' => 'primary',
    ]);
    $this->otherRole->permissions()->create(['permission_key' => 'utilize_sandbox_rosters', 'value' => 'YES']);
    $this->otherUser->roles()->attach($this->otherRole->id);

    // Create a main roster (non-sandbox)
    $this->mainRoster = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'Main Roster',
        'shortname' => 'MAIN',
        'color' => '#123456',
        'order' => 0,
        'columns' => [
            ['id' => 'name', 'name' => 'Name', 'type' => 'text'],
        ],
        'created_by' => $this->leader->id,
        'is_sandbox' => false,
    ]);

    // Grant view access to the user's role so it is visible in the tests
    $this->mainRoster->rosterPermissions()->create([
        'role_id' => $this->userRole->id,
        'permissions' => ['view_roster'],
    ]);

    $this->mainSection = $this->mainRoster->sections()->create([
        'name' => 'Command',
        'shortname' => 'CMD',
        'type' => 'master',
        'order' => 0,
        'created_by' => $this->leader->id,
    ]);

    $this->mainSection->contents()->create([
        'type' => 'predefined',
        'content' => ['name' => 'Santiago Hernandez'],
        'created_by' => $this->leader->id,
    ]);
});

test('FactionController show separates regular and sandbox rosters', function () {
    // 1. Create a sandbox roster for User
    $sandboxRoster = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'User Sandbox Roster',
        'shortname' => 'SAND',
        'color' => '#654321',
        'order' => 1,
        'columns' => [
            ['id' => 'name', 'name' => 'Name', 'type' => 'text'],
        ],
        'created_by' => $this->user->id,
        'is_sandbox' => true,
    ]);

    // 2. Fetch faction payload as User
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    // Regular rosters should not contain user sandbox
    $rosters = $data['rosters'];
    expect(count($rosters))->toBe(1);
    expect($rosters[0]['id'])->toBe($this->mainRoster->id);

    // sandbox_rosters should contain user sandbox
    $sandboxRosters = $data['sandbox_rosters'];
    expect(count($sandboxRosters))->toBe(1);
    expect($sandboxRosters[0]['id'])->toBe($sandboxRoster->id);
    expect($sandboxRosters[0]['user_roster_permissions']['modify_roster'])->toBeTrue();

    // 3. Fetch faction payload as OtherUser
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->otherUser)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    // OtherUser has utilize_sandbox_rosters but no sandboxes created yet.
    // They should not see User's sandbox roster.
    expect(count($data['sandbox_rosters']))->toBe(0);
});

test('Users can create and manage their own sandbox rosters', function () {
    // 1. Create sandbox roster via POST
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->postJson('/api/factions/lssd/rosters', [
        'name' => 'My Test Sandbox',
        'shortname' => 'TEST',
        'color' => '#00ff00',
        'is_sandbox' => true,
    ]);
    $response->assertStatus(201);
    $rosterId = $response->json('id');

    $roster = Roster::findOrFail($rosterId);
    expect($roster->is_sandbox)->toBeTrue();
    expect($roster->created_by)->toBe($this->user->id);

    // 2. Update sandbox roster
    $response = $this->actingAs($this->user)->putJson("/api/rosters/{$rosterId}", [
        'name' => 'Updated Sandbox Name',
    ]);
    $response->assertStatus(200);
    expect($roster->refresh()->name)->toBe('Updated Sandbox Name');

    // 3. Unauthorized user cannot update sandbox roster
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->otherUser)->putJson("/api/rosters/{$rosterId}", [
        'name' => 'Hacked Name',
    ]);
    $response->assertStatus(403);

    // 4. Delete sandbox roster
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->deleteJson("/api/rosters/{$rosterId}");
    $response->assertStatus(200);
    expect($roster->refresh()->deleted_at)->not->toBeNull();
});

test('Sandbox rosters bypass auditing and revisions', function () {
    // Clear previous logs/revisions
    AuditLog::truncate();
    RosterRevision::truncate();

    // 1. Create a sandbox roster
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->postJson('/api/factions/lssd/rosters', [
        'name' => 'Silent Roster',
        'shortname' => 'SILT',
        'color' => '#ffffff',
        'is_sandbox' => true,
    ]);
    $response->assertStatus(201);
    $rosterId = $response->json('id');

    // Verify no AuditLogs or RosterRevisions were created for this roster creation
    expect(AuditLog::count())->toBe(0);
    expect(RosterRevision::count())->toBe(0);

    // 2. Add a section to sandbox roster
    $response = $this->actingAs($this->user)->postJson("/api/rosters/{$rosterId}/sections", [
        'name' => 'Sandbox Section',
        'shortname' => 'SSEC',
        'type' => 'section',
        'data_source' => 'manual',
    ]);
    $response->assertStatus(201);
    $sectionId = $response->json('id');

    expect(AuditLog::count())->toBe(0);
    expect(RosterRevision::count())->toBe(0);

    // 3. Add content to sandbox section
    $response = $this->actingAs($this->user)->postJson("/api/sections/{$sectionId}/contents", [
        'type' => 'predefined',
        'content' => ['name' => 'Alice'],
    ]);
    $response->assertStatus(201);

    expect(AuditLog::count())->toBe(0);
    expect(RosterRevision::count())->toBe(0);
});

test('RosterPermissionController and RosterRevisionController are blocked for sandbox rosters', function () {
    $sandboxRoster = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'User Sandbox Roster',
        'shortname' => 'SAND',
        'color' => '#654321',
        'order' => 1,
        'columns' => [['id' => 'name', 'name' => 'Name', 'type' => 'text']],
        'created_by' => $this->user->id,
        'is_sandbox' => true,
    ]);

    // Permissions access block
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson("/api/rosters/{$sandboxRoster->id}/permissions");
    $response->assertStatus(403);

    // Revisions access block
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson("/api/rosters/{$sandboxRoster->id}/revisions");
    $response->assertStatus(403);
});

test('Sandbox rosters support cross-dynamic mapping with main rosters', function () {
    // 1. Create a sandbox roster for User
    $sandboxRoster = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'User Sandbox Roster',
        'shortname' => 'SAND',
        'color' => '#654321',
        'order' => 1,
        'columns' => [
            ['id' => 'full_name', 'name' => 'Full Name', 'type' => 'text'],
        ],
        'created_by' => $this->user->id,
        'is_sandbox' => true,
    ]);

    // 2. Add a dynamic section pulling from the main roster section
    $dynamicSection = $sandboxRoster->sections()->create([
        'name' => 'Linked Main Section',
        'shortname' => 'LINK',
        'type' => 'subsection',
        'order' => 0,
        'data_source' => 'dynamic',
        'section_options' => [
            'dynamic_config' => [
                'source_type' => 'section',
                'source_id' => $this->mainSection->id,
                'rules' => [],
                'mappings' => [
                    'full_name' => 'name',
                ],
            ],
        ],
        'created_by' => $this->user->id,
    ]);

    // 3. Fetch faction payload. The dynamic section in sandbox should resolve successfully!
    Auth::guard('sanctum')->forgetUser();
    $response = $this->actingAs($this->user)->getJson('/api/factions/lssd');
    $response->assertStatus(200);
    $data = $response->json();

    $sandboxRosters = $data['sandbox_rosters'];
    $dynSec = collect($sandboxRosters[0]['root_sections'])->firstWhere('id', $dynamicSection->id);
    expect($dynSec)->not->toBeNull();
    expect(count($dynSec['contents']))->toBe(1);
    expect($dynSec['contents'][0]['content']['full_name'])->toBe('Santiago Hernandez');
});
