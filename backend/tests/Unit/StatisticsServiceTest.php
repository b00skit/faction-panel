<?php

use App\Formula\EvaluationContext;
use App\Formula\Lexer;
use App\Formula\Parser;
use App\Models\Faction;
use App\Models\Roster;
use App\Models\RosterContent;
use App\Models\RosterSection;
use App\Models\StatisticsModel;
use App\Models\StatisticsWidget;
use App\Services\FormulaEvaluatorService;
use App\Services\StatisticsService;

test('lexer tokenizes formulas correctly', function () {
    $lexer = new Lexer("sum(roster_rows(1, 'Status', 'Active'), 'col_hours') + 10.5");
    $tokens = $lexer->tokenize();

    expect($tokens)->not->toBeEmpty();
    expect($tokens[0]->type)->toBe('IDENTIFIER');
    expect($tokens[0]->value)->toBe('sum');
});

test('parser parses simple expressions correctly', function () {
    $lexer = new Lexer('12 - (1 + 2)');
    $tokens = $lexer->tokenize();

    $parser = new Parser($tokens);
    $ast = $parser->parse();

    $context = new EvaluationContext(1);
    $result = $ast->evaluate($context);

    expect($result)->toBe(9.0);
});

test('evaluator executes math formulas correctly', function () {
    $evaluator = new FormulaEvaluatorService;
    $result = $evaluator->evaluate('10 * 2.5 + 5', 1);
    expect($result)->toBe(30.0);
});

test('evaluator resolves roster counts and rows correctly', function () {
    $faction = Faction::factory()->create();
    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'LSPD Patrol',
        'shortname' => 'patrol',
        'columns' => [
            ['id' => 'col_status', 'name' => 'Status', 'type' => 'select'],
            ['id' => 'col_hours', 'name' => 'Hours', 'type' => 'number'],
        ],
        'created_by' => null,
        'color' => '#ffffff',
    ]);

    $section = RosterSection::create([
        'roster_id' => $roster->id,
        'name' => 'Section A',
        'type' => 'section',
        'shortname' => 'section-a',
    ]);

    RosterContent::create([
        'section_id' => $section->id,
        'content' => ['col_status' => 'Active', 'col_hours' => 12],
    ]);

    RosterContent::create([
        'section_id' => $section->id,
        'content' => ['col_status' => 'LOA', 'col_hours' => 5],
    ]);

    RosterContent::create([
        'section_id' => $section->id,
        'content' => ['col_status' => 'Active', 'col_hours' => 8],
    ]);

    $evaluator = new FormulaEvaluatorService;

    // 1. roster_count
    $count = $evaluator->evaluate("roster_count('patrol', 'Status', 'Active')", $faction->id);
    expect($count)->toBe(2.0);

    // 2. sum of hours for active members
    $sum = $evaluator->evaluate("sum(roster_rows('patrol', 'Status', 'Active'), 'Hours')", $faction->id);
    expect($sum)->toBe(20.0);

    // 3. average of hours for all members
    $avg = $evaluator->evaluate("avg(roster_rows('patrol'), 'Hours')", $faction->id);
    expect($avg)->toBe(8.33);
});

test('statistics service calculates pie chart widget series correctly', function () {
    $faction = Faction::factory()->create();
    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'LSPD Patrol',
        'shortname' => 'patrol',
        'columns' => [
            ['id' => 'col_status', 'name' => 'Status', 'type' => 'select'],
        ],
        'color' => '#ffffff',
    ]);
    $section = RosterSection::create(['roster_id' => $roster->id, 'name' => 'A', 'type' => 'section', 'shortname' => 'a']);
    RosterContent::create(['section_id' => $section->id, 'content' => ['col_status' => 'Active']]);

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
                ['name' => 'Active', 'color' => '#00ff00', 'formula' => "roster_count('patrol', 'Status', 'Active')"],
                ['name' => 'LOA', 'color' => '#ff0000', 'formula' => "roster_count('patrol', 'Status', 'LOA')"],
            ],
        ],
    ]);

    $statisticsService = new StatisticsService(new FormulaEvaluatorService);
    $result = $statisticsService->calculate($widget, true);

    expect($result['data'])->toBe([
        ['name' => 'Active', 'value' => 1.0, 'color' => '#00ff00', 'default_hidden' => false],
        ['name' => 'LOA', 'value' => 0.0, 'color' => '#ff0000', 'default_hidden' => false],
    ]);
});

test('statistics service calculates series with default_hidden flag correctly', function () {
    $faction = Faction::factory()->create();
    $model = StatisticsModel::create(['faction_id' => $faction->id, 'name' => 'Dashboard']);
    $widget = StatisticsWidget::create([
        'statistics_model_id' => $model->id,
        'name' => 'Active Officers',
        'type' => 'pie',
        'configuration' => [
            'mode' => 'series',
            'series' => [
                ['name' => 'Active', 'color' => '#00ff00', 'formula' => '5', 'default_hidden' => false],
                ['name' => 'LOA', 'color' => '#ff0000', 'formula' => '2', 'default_hidden' => true],
            ],
        ],
    ]);

    $statisticsService = new StatisticsService(new FormulaEvaluatorService);
    $result = $statisticsService->calculate($widget, true);

    expect($result['data'])->toBe([
        ['name' => 'Active', 'value' => 5.0, 'color' => '#00ff00', 'default_hidden' => false],
        ['name' => 'LOA', 'value' => 2.0, 'color' => '#ff0000', 'default_hidden' => true],
    ]);
});

test('statistics service calculates grouped widgets with custom label settings correctly', function () {
    $faction = Faction::factory()->create();
    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'LSPD Patrol',
        'shortname' => 'patrol',
        'columns' => [['id' => 'col_status', 'name' => 'Status', 'type' => 'select']],
        'color' => '#ffffff',
    ]);
    $section = RosterSection::create(['roster_id' => $roster->id, 'name' => 'A', 'type' => 'section', 'shortname' => 'a']);
    RosterContent::create(['section_id' => $section->id, 'content' => ['col_status' => 'Active']]);
    RosterContent::create(['section_id' => $section->id, 'content' => ['col_status' => 'LOA']]);

    $model = StatisticsModel::create(['faction_id' => $faction->id, 'name' => 'Dashboard']);
    $widget = StatisticsWidget::create([
        'statistics_model_id' => $model->id,
        'name' => 'Grouped Patrol',
        'type' => 'pie',
        'configuration' => [
            'mode' => 'grouped',
            'formula' => "roster_rows('patrol')",
            'group_by_column' => 'Status',
            'label_settings' => [
                'Active' => ['color' => '#00ff00', 'default_hidden' => false],
                'LOA' => ['color' => '#ff0000', 'default_hidden' => true],
            ],
        ],
    ]);

    $statisticsService = new StatisticsService(new FormulaEvaluatorService);
    $result = $statisticsService->calculate($widget, true);

    // Collect data to avoid order issues
    $data = collect($result['data'])->keyBy('name');

    expect($data->get('Active'))->toBe([
        'name' => 'Active',
        'value' => 1.0,
        'color' => '#00ff00',
        'default_hidden' => false,
    ]);

    expect($data->get('LOA'))->toBe([
        'name' => 'LOA',
        'value' => 1.0,
        'color' => '#ff0000',
        'default_hidden' => true,
    ]);
});
