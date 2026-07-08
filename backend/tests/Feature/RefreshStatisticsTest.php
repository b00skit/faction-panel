<?php

use App\Models\Faction;
use App\Models\StatisticsModel;
use App\Models\StatisticsWidget;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;

test('statistics:refresh command recalculates widgets and updates cache', function () {
    $faction = Faction::factory()->create();
    $model = StatisticsModel::create([
        'faction_id' => $faction->id,
        'name' => 'Dashboard',
    ]);

    $widget = StatisticsWidget::create([
        'statistics_model_id' => $model->id,
        'name' => 'Active Officer Pie',
        'type' => 'pie',
        'configuration' => [
            'mode' => 'series',
            'series' => [
                ['name' => 'Constant', 'color' => '#00ff00', 'formula' => '5 + 2'],
            ],
        ],
        'cache_result' => null,
        'last_calculated_at' => null,
    ]);

    // Run the Artisan command
    $exitCode = Artisan::call('statistics:refresh');

    expect($exitCode)->toBe(0);

    // Refresh widget from database
    $widget->refresh();

    expect($widget->cache_result)->not->toBeNull();
    expect($widget->cache_result[0]['value'])->toEqual(7.0);
    expect($widget->last_calculated_at)->not->toBeNull();
});

test('statistics controller show route dispatches background refresh if stale', function () {
    $faction = Faction::factory()->create();
    $user = User::factory()->create(['is_superadmin' => true]);
    $user->factions()->attach($faction->id);

    $model = StatisticsModel::create([
        'faction_id' => $faction->id,
        'name' => 'Dashboard',
    ]);

    $widget = StatisticsWidget::create([
        'statistics_model_id' => $model->id,
        'name' => 'Constant Widget',
        'type' => 'pie',
        'configuration' => [
            'mode' => 'series',
            'series' => [
                ['name' => 'Value', 'color' => '#00ff00', 'formula' => '10'],
            ],
        ],
        'cache_result' => null,
        'last_calculated_at' => null, // Stale!
    ]);

    // Request the show route
    $response = $this->actingAs($user)
        ->getJson("/api/statistics/{$model->id}");

    $response->assertStatus(200);

    // Refresh widget from database to check cache calculations
    $widget->refresh();
    expect($widget->cache_result)->not->toBeNull();
    expect($widget->cache_result[0]['value'])->toEqual(10.0);
    expect($widget->last_calculated_at)->not->toBeNull();
});
