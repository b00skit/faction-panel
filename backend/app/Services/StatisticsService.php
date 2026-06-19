<?php

namespace App\Services;

use App\Models\StatisticsWidget;

class StatisticsService
{
    protected FormulaEvaluatorService $evaluator;

    public function __construct(FormulaEvaluatorService $evaluator)
    {
        $this->evaluator = $evaluator;
    }

    public function calculate(StatisticsWidget $widget, bool $forceRefresh = false): array
    {
        $config = $widget->configuration;
        $factionId = $widget->statisticsModel->faction_id;

        // Snapshot System: Return cached data if it's fresh enough and it's marked as intensive
        if (! $forceRefresh && $widget->is_intensive && $widget->last_calculated_at && $widget->last_calculated_at->gt(now()->subMinutes(10))) {
            return [
                'data' => $widget->cache_result,
                'is_intensive' => true,
                'from_cache' => true,
                'last_calculated_at' => $widget->last_calculated_at,
            ];
        }

        $data = [];
        $mode = $config['mode'] ?? 'series';

        if ($mode === 'grouped') {
            $formula = $config['formula'] ?? '';
            $groupByCol = $config['group_by_column'] ?? '';
            $labelSettings = $config['label_settings'] ?? [];
            try {
                $rows = $this->evaluator->evaluate($formula, $factionId);
                $grouped = $this->evaluator->toCollection($rows)->groupBy(function ($item) use ($groupByCol) {
                    $val = $this->evaluator->getPropertyVal($item, $groupByCol) ?? 'Unknown';
                    return is_array($val) ? json_encode($val) : (string)$val;
                });

                foreach ($grouped as $key => $items) {
                    $labelSetting = $labelSettings[$key] ?? [];
                    $data[] = [
                        'name' => $key,
                        'value' => (float)$items->count(),
                        'color' => $labelSetting['color'] ?? null,
                        'default_hidden' => $labelSetting['default_hidden'] ?? false,
                    ];
                }
            } catch (\Throwable $e) {
                // Return empty/error result gracefully
                $data = [];
            }
        } else {
            // Series mode (default)
            $series = $config['series'] ?? [];
            foreach ($series as $s) {
                try {
                    $val = $this->evaluator->evaluate($s['formula'] ?? '0', $factionId);
                    $data[] = [
                        'name' => $s['name'] ?? 'Data',
                        'value' => (float)$val,
                        'color' => $s['color'] ?? null,
                        'default_hidden' => $s['default_hidden'] ?? false,
                    ];
                } catch (\Throwable $e) {
                    $data[] = [
                        'name' => $s['name'] ?? 'Data',
                        'value' => 0.0,
                        'color' => $s['color'] ?? null,
                        'default_hidden' => $s['default_hidden'] ?? false,
                    ];
                }
            }
        }

        $widget->updateQuietly([
            'cache_result' => $data,
            'last_calculated_at' => now(),
            'is_intensive' => false,
        ]);

        return [
            'data' => $data,
            'is_intensive' => false,
            'from_cache' => false,
            'last_calculated_at' => now(),
        ];
    }
}
