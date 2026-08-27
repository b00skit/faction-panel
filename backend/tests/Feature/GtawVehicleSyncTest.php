<?php

use App\Models\Faction;
use App\Models\User;
use App\Services\GtawService;
use App\Services\GtawSyncService;

beforeEach(function () {
    $this->leader = User::factory()->create([
        'gtaw_access_token' => 'mock-access-token',
        'gtaw_id' => 9999,
        'gtaw_username' => 'LeaderName',
    ]);

    $this->faction = Faction::create([
        'shortname' => 'pd',
        'name' => 'Los Santos Police Department',
        'color' => '#14571f',
        'visibility' => 'public',
        'access' => 'invite-only',
        'faction_leader' => $this->leader->id,
        'created_by' => $this->leader->id,
        'gtaw_faction_id' => 1,
    ]);

    $this->faction->users()->attach($this->leader->id);
});

test('gtaw sync provisions vehicle databases and synchronizes vehicle list', function () {
    $this->mock(GtawService::class, function ($mock) {
        $mock->shouldReceive('getFactionMembers')->andReturn([
            'data' => [
                'members' => [],
            ],
        ]);
        $mock->shouldReceive('getFactionAbas')->andReturn(['data' => []]);
        $mock->shouldReceive('getFactionVehicles')->andReturn([
            'data' => [
                'id' => 1,
                'name' => 'Los Santos Police Department',
                'short_name' => 'LSPD',
                'vehicles' => [
                    [
                        'id' => 501,
                        'plate' => 'POLICE1',
                        'model' => 'police',
                        'model_name' => 'Vapid Stanier',
                        'distance_driven' => 1200.5,
                        'hasalpr' => 1,
                        'last_maintenance_distance' => 1000.0,
                        'owner' => 10,
                        'owner_name' => 'John Doe',
                        'business' => 0,
                        'business_name' => null,
                    ],
                ],
            ],
        ]);
    });

    $syncService = app(GtawSyncService::class);
    $results = $syncService->sync($this->faction, $this->leader, 'manual');

    expect($results['vehicles_added'])->toBe(1);
    expect($results['vehicles_updated'])->toBe(0);
    expect($results['vehicles_removed'])->toBe(0);

    // Verify VEHICLES database created
    $vehDb = $syncService->findGtawDatabase($this->faction, 'VEHICLES');
    expect($vehDb)->not->toBeNull();

    $entry = $vehDb->entries()->where('is_active', true)->first();
    expect($entry)->not->toBeNull();
    expect($entry->data['vehicle_id'])->toBe(501);
    expect($entry->data['plate'])->toBe('POLICE1');
    expect($entry->data['model_name'])->toBe('Vapid Stanier');
    expect($entry->data['owner_name'])->toBe('John Doe');

    // Verify VEHIST database created and logged 'Added'
    $vehHistDb = $syncService->findGtawDatabase($this->faction, 'VEHIST');
    expect($vehHistDb)->not->toBeNull();

    $histEntry = $vehHistDb->entries()->first();
    expect($histEntry)->not->toBeNull();
    expect($histEntry->data['vehicle_id'])->toBe(501);
    expect($histEntry->data['action'])->toBe('Added');
});

test('gtaw sync updates modified vehicles and logs removed vehicles in history', function () {
    // 1. First sync with 2 vehicles
    $this->mock(GtawService::class, function ($mock) {
        $mock->shouldReceive('getFactionMembers')->andReturn(['data' => ['members' => []]]);
        $mock->shouldReceive('getFactionAbas')->andReturn(['data' => []]);
        $mock->shouldReceive('getFactionVehicles')->andReturn([
            'data' => [
                'vehicles' => [
                    [
                        'id' => 101,
                        'plate' => 'LSPD01',
                        'model' => 'police',
                        'model_name' => 'Vapid Stanier',
                        'distance_driven' => 500,
                        'hasalpr' => 0,
                        'last_maintenance_distance' => 0,
                        'owner' => null,
                        'owner_name' => null,
                        'business' => null,
                        'business_name' => null,
                    ],
                    [
                        'id' => 102,
                        'plate' => 'LSPD02',
                        'model' => 'scout',
                        'model_name' => 'Vapid Scout',
                        'distance_driven' => 200,
                        'hasalpr' => 1,
                        'last_maintenance_distance' => 100,
                        'owner' => null,
                        'owner_name' => null,
                        'business' => null,
                        'business_name' => null,
                    ],
                ],
            ],
        ]);
    });

    $syncService = app(GtawSyncService::class);
    $results1 = $syncService->sync($this->faction, $this->leader, 'manual');
    expect($results1['vehicles_added'])->toBe(2);

    // 2. Second sync: vehicle 101 modified (distance_driven changed), vehicle 102 removed
    unset($this->app[GtawService::class]);
    $this->mock(GtawService::class, function ($mock) {
        $mock->shouldReceive('getFactionMembers')->andReturn(['data' => ['members' => []]]);
        $mock->shouldReceive('getFactionAbas')->andReturn(['data' => []]);
        $mock->shouldReceive('getFactionVehicles')->andReturn([
            'data' => [
                'vehicles' => [
                    [
                        'id' => 101,
                        'plate' => 'LSPD01',
                        'model' => 'police',
                        'model_name' => 'Vapid Stanier',
                        'distance_driven' => 800, // modified
                        'hasalpr' => 0,
                        'last_maintenance_distance' => 0,
                        'owner' => null,
                        'owner_name' => null,
                        'business' => null,
                        'business_name' => null,
                    ],
                ],
            ],
        ]);
    });

    $syncService2 = app(GtawSyncService::class);
    $results2 = $syncService2->sync($this->faction, $this->leader, 'manual');
    expect($results2['vehicles_added'])->toBe(0);
    expect($results2['vehicles_updated'])->toBe(1);
    expect($results2['vehicles_removed'])->toBe(1);

    $vehHistDb = $syncService->findGtawDatabase($this->faction, 'VEHIST');
    $removedHist = $vehHistDb->entries()->where('data->action', 'Removed')->first();
    expect($removedHist)->not->toBeNull();
    expect($removedHist->data['vehicle_id'])->toBe(102);
});

test('pruning gtaw integration prunes vehicle database entries', function () {
    $this->mock(GtawService::class, function ($mock) {
        $mock->shouldReceive('getFactionMembers')->andReturn(['data' => ['members' => []]]);
        $mock->shouldReceive('getFactionAbas')->andReturn(['data' => []]);
        $mock->shouldReceive('getFactionVehicles')->andReturn([
            'data' => [
                'vehicles' => [
                    [
                        'id' => 999,
                        'plate' => 'PRUNE1',
                        'model' => 'police',
                        'model_name' => 'Vapid Stanier',
                        'distance_driven' => 100,
                        'hasalpr' => 0,
                        'last_maintenance_distance' => 0,
                        'owner' => null,
                        'owner_name' => null,
                        'business' => null,
                        'business_name' => null,
                    ],
                ],
            ],
        ]);
    });

    $syncService = app(GtawSyncService::class);
    $syncService->sync($this->faction, $this->leader, 'manual');

    $vehDb = $syncService->findGtawDatabase($this->faction, 'VEHICLES');
    expect($vehDb->entries()->count())->toBe(1);

    // Call prune endpoint
    $response = $this->actingAs($this->leader)->postJson('/api/factions/pd/integrations/gtaw/prune');
    $response->assertStatus(200);

    expect($vehDb->entries()->count())->toBe(0);
});
