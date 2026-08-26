<?php

use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Models\GtawSyncAutomation;
use App\Models\User;
use App\Services\GtawService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Artisan;

beforeEach(function () {
    $this->leader = User::factory()->create([
        'gtaw_access_token' => 'mock-access-token',
        'gtaw_id' => 9999,
        'gtaw_username' => 'LeaderName',
    ]);

    $this->member = User::factory()->create();

    $this->faction = Faction::create([
        'shortname' => 'lssd',
        'name' => 'Los Santos County Sheriff\'s Department',
        'color' => '#14571f',
        'visibility' => 'public',
        'access' => 'invite-only',
        'faction_leader' => $this->leader->id,
        'created_by' => $this->leader->id,
        'gtaw_faction_id' => 10,
    ]);

    $this->faction->users()->attach($this->leader->id);
    $this->faction->users()->attach($this->member->id);

    // Set up CHARS database structure
    $this->charDb = FactionRecordDatabase::create([
        'faction_id' => $this->faction->id,
        'name' => 'Characters Database',
        'record_shortcode' => 'CHARS',
        'is_api_database' => 'gtaw_characters',
        'database_structure' => [
            ['id' => 'id', 'name' => 'ID', 'type' => 'number', 'required' => true],
            ['id' => 'name', 'name' => 'Character Name', 'type' => 'text', 'required' => true],
            ['id' => 'rank', 'name' => 'Rank', 'type' => 'text', 'required' => true],
            ['id' => 'abas', 'name' => 'ABAS', 'type' => 'text', 'required' => false],
            ['id' => 'total_abas', 'name' => 'Total ABAS', 'type' => 'text', 'required' => false],
            ['id' => 'user_id', 'name' => 'User ID', 'type' => 'number', 'required' => true],
            ['id' => 'char_id', 'name' => 'Character ID', 'type' => 'number', 'required' => true],
            ['id' => 'is_alt', 'name' => 'Alternative Character', 'type' => 'boolean', 'required' => true],
        ],
        'is_published' => true,
        'created_by' => $this->leader->id,
        'data_overview_display' => 'table',
        'data_entry_display' => 'card',
    ]);
});

test('automation settings are only accessible by leader or superadmin', function () {
    // 1. Unauthenticated gets 401
    $response = $this->getJson('/api/factions/lssd/integrations/gtaw/automation');
    $response->assertStatus(401);

    // 2. Faction member gets 403
    $response = $this->actingAs($this->member)->getJson('/api/factions/lssd/integrations/gtaw/automation');
    $response->assertStatus(403);

    // 3. Faction leader gets 200
    $response = $this->actingAs($this->leader)->getJson('/api/factions/lssd/integrations/gtaw/automation');
    $response->assertStatus(200);

    // 4. Superadmin gets 200
    $superadmin = User::factory()->create(['is_superadmin' => true]);
    $response = $this->actingAs($superadmin)->getJson('/api/factions/lssd/integrations/gtaw/automation');
    $response->assertStatus(200);
});

test('saving automation settings schedules next_run_at correctly', function () {
    Carbon::setTestNow('2026-07-08 12:00:00');

    $payload = [
        'enabled' => true,
        'frequency' => 'daily',
        'time_of_day' => '14:30',
    ];

    $response = $this->actingAs($this->leader)
        ->postJson('/api/factions/lssd/integrations/gtaw/automation', $payload);

    $response->assertStatus(200);
    $this->assertDatabaseHas('gtaw_sync_automations', [
        'faction_id' => $this->faction->id,
        'enabled' => true,
        'frequency' => 'daily',
        'time_of_day' => '14:30',
        'next_run_at' => '2026-07-08 14:30:00',
    ]);

    // Test disabling clears next_run_at
    $payload['enabled'] = false;
    $response2 = $this->actingAs($this->leader)
        ->postJson('/api/factions/lssd/integrations/gtaw/automation', $payload);

    $response2->assertStatus(200);
    $this->assertDatabaseHas('gtaw_sync_automations', [
        'faction_id' => $this->faction->id,
        'enabled' => false,
        'next_run_at' => null,
    ]);

    Carbon::setTestNow(); // Reset test time
});

test('scheduler command runs due syncs and records execution history', function () {
    Carbon::setTestNow('2026-07-08 12:00:00');

    // 1. Create a due automation
    GtawSyncAutomation::create([
        'faction_id' => $this->faction->id,
        'enabled' => true,
        'frequency' => 'every_2_days',
        'time_of_day' => '10:00', // daily anchor. For 48h: runs every 2 days
        'next_run_at' => '2026-07-08 10:00:00', // overdue
        'created_by' => $this->leader->id,
    ]);

    // 2. Mock GtawService sync call
    $this->mock(GtawService::class, function ($mock) {
        $mock->shouldReceive('getFactionMembers')->andReturn([
            'data' => [
                'members' => [
                    [
                        'character_id' => 101,
                        'character_name' => 'James Vance',
                        'rank_name' => 'Deputy Sheriff',
                        'rank' => 3,
                        'abas' => 0.00,
                        'user_id' => 12,
                    ],
                ],
            ],
        ]);

        $mock->shouldReceive('getFactionAbas')->andReturn(['data' => []]);
    });

    // 3. Execute console command
    $exitCode = Artisan::call('gtaw:sync-automation');
    expect($exitCode)->toBe(0);

    // 4. Verify character added to character DB
    $dbEntry = $this->charDb->entries()->where('is_active', true)->first();
    expect($dbEntry)->not->toBeNull();
    expect($dbEntry->data['name'])->toBe('James Vance');

    // 5. Verify log record exists in database
    $this->assertDatabaseHas('gtaw_sync_logs', [
        'faction_id' => $this->faction->id,
        'trigger_type' => 'automated',
        'user_id' => $this->leader->id,
        'status' => 'success',
    ]);

    // 6. Verify next_run_at got bumped to next 48h interval (2026-07-10 10:00:00)
    $automation = GtawSyncAutomation::where('faction_id', $this->faction->id)->first();
    expect($automation->next_run_at->toDateTimeString())->toBe('2026-07-10 10:00:00');

    Carbon::setTestNow();
});

test('scheduler command logs failure when leader has no GTA:W token', function () {
    Carbon::setTestNow('2026-07-08 12:00:00');

    // 1. Remove leader token
    $this->leader->update(['gtaw_access_token' => null]);

    // 2. Create overdue automation
    GtawSyncAutomation::create([
        'faction_id' => $this->faction->id,
        'enabled' => true,
        'frequency' => 'daily',
        'time_of_day' => '00:00',
        'next_run_at' => '2026-07-08 11:00:00',
        'created_by' => $this->leader->id,
    ]);

    // 3. Run command
    $exitCode = Artisan::call('gtaw:sync-automation');
    expect($exitCode)->toBe(0);

    // 4. Verify log entry has correct failure reason
    $this->assertDatabaseHas('gtaw_sync_logs', [
        'faction_id' => $this->faction->id,
        'trigger_type' => 'automated',
        'user_id' => $this->leader->id,
        'status' => 'failed',
        'error' => 'Faction leader has not linked their GTA:W account.',
    ]);

    // 5. Verify next_run_at got updated to next day (2026-07-09 00:00:00)
    $automation = GtawSyncAutomation::where('faction_id', $this->faction->id)->first();
    expect($automation->next_run_at->toDateTimeString())->toBe('2026-07-09 00:00:00');

    Carbon::setTestNow();
});

test('manual sync endpoint logs execution history', function () {
    // 1. Mock GtawService
    $this->mock(GtawService::class, function ($mock) {
        $mock->shouldReceive('getFactionMembers')->andReturn([
            'data' => [
                'members' => [],
            ],
        ]);

        $mock->shouldReceive('getFactionAbas')->andReturn(['data' => []]);
    });

    // 2. Run manual sync
    $response = $this->actingAs($this->leader)->postJson('/api/factions/lssd/integrations/gtaw/sync');
    $response->assertStatus(200);

    // 3. Verify manual log recorded
    $this->assertDatabaseHas('gtaw_sync_logs', [
        'faction_id' => $this->faction->id,
        'trigger_type' => 'manual',
        'user_id' => $this->leader->id,
        'status' => 'success',
    ]);
});
