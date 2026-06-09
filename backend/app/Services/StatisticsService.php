<?php

namespace App\Services;

use App\Models\FactionRecordDatabase;
use App\Models\Roster;
use App\Models\RosterContent;
use App\Models\RosterSection;
use App\Models\StatisticsWidget;
use Illuminate\Support\Collection;

class StatisticsService
{
    protected $rosterPoolsCache = [];

    protected $columnIdMapsCache = [];

    protected $sectionsCache = [];

    protected $rosterLookupsCache = [];

    protected function getRealColumnId($sectionId, $targetColName)
    {
        $cacheKey = $sectionId.'_'.$targetColName;
        if (isset($this->columnIdMapsCache[$cacheKey])) {
            return $this->columnIdMapsCache[$cacheKey];
        }

        if (isset($this->sectionsCache[$sectionId])) {
            $section = $this->sectionsCache[$sectionId];
        } else {
            $section = RosterSection::with('roster')->find($sectionId);
            if ($section) {
                $this->sectionsCache[$sectionId] = $section;
            }
        }

        if (! $section) {
            $this->columnIdMapsCache[$cacheKey] = $targetColName;

            return $targetColName;
        }

        $columns = $section->use_roster_columns ? ($section->roster->columns ?? []) : ($section->columns ?? []);
        foreach ($columns as $col) {
            if (($col['name'] ?? '') === $targetColName || ($col['id'] ?? '') === $targetColName) {
                $this->columnIdMapsCache[$cacheKey] = $col['id'];

                return $col['id'];
            }
        }

        $this->columnIdMapsCache[$cacheKey] = $targetColName;

        return $targetColName;
    }

    protected function getRosterPoolCached($rosterId): Collection
    {
        if (! isset($this->rosterPoolsCache[$rosterId])) {
            $totalRows = 0;
            $this->rosterPoolsCache[$rosterId] = $this->getSourcePool('roster', $rosterId, $totalRows);
        }

        return $this->rosterPoolsCache[$rosterId];
    }

    public function calculate(StatisticsWidget $widget, bool $forceRefresh = false): array
    {
        $config = $widget->configuration;
        $intensive = false;
        $totalRowsProcessed = 0;

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

        if ($widget->type === 'table') {
            $data = $this->calculateTable($widget, $config, $totalRowsProcessed);
        } elseif (isset($config['group_by']) && $config['group_by']['source_id']) {
            $data = $this->calculateGrouped($widget, $config, $totalRowsProcessed);
        } else {
            $data = $this->calculateSeries($widget, $config['series'] ?? [], $totalRowsProcessed);
        }

        if ($totalRowsProcessed > 1000) {
            $intensive = true;
        }

        // Update widget with new snapshot if it's intensive or if it was already marked intensive
        if ($intensive || $widget->is_intensive) {
            $widget->updateQuietly([
                'cache_result' => $data,
                'last_calculated_at' => now(),
                'is_intensive' => $intensive,
            ]);
        }

        return [
            'data' => $data,
            'is_intensive' => $intensive,
            'from_cache' => false,
            'last_calculated_at' => now(),
        ];
    }

    protected function calculateSeries(StatisticsWidget $widget, array $series, &$totalRowsProcessed): array
    {
        $result = [];

        foreach ($series as $s) {
            if (empty($s['source_id']) && $s['source_type'] !== 'count') {
                continue;
            }

            // Handle Count source type separately as it's not a pool of rows
            if ($s['source_type'] === 'count') {
                $val = $this->evaluateCount($s['count_config'] ?? [], $s['count_parent_type'] ?? 'roster', $s['count_parent_id'] ?? null, $totalRowsProcessed);
                $result[] = [
                    'name' => $s['name'],
                    'value' => $val,
                    'color' => $s['color'] ?? null,
                ];

                continue;
            }

            // Try to use SQL aggregation first
            $sqlValue = $this->calculateSeriesWithSql($s);
            if ($sqlValue !== null) {
                $result[] = [
                    'name' => $s['name'],
                    'value' => $sqlValue,
                    'color' => $s['color'] ?? null,
                ];

                continue;
            }

            $pool = $this->getSourcePool($s['source_type'], $s['source_id'], $totalRowsProcessed, $s);

            // Handle Logic Groups
            if (isset($s['logic_groups']) && ! empty($s['logic_groups'])) {
                $totalValue = 0;
                foreach ($s['logic_groups'] as $group) {
                    $groupPool = $this->applyConditions($pool, $group['conditions'] ?? [], $s['source_type'], $group['operator'] ?? 'AND');

                    $operation = $group['operation'] ?? 'count';
                    $targetCol = $group['target_col'] ?? null;

                    $groupValue = $this->aggregatePool($groupPool, $operation, $targetCol, $s['source_type']);

                    $math = $group['math_operator'] ?? '+';
                    if ($math === '+') {
                        $totalValue += $groupValue;
                    } elseif ($math === '-') {
                        $totalValue -= $groupValue;
                    } elseif ($math === '*') {
                        $totalValue *= $groupValue;
                    } elseif ($math === '/' && $groupValue != 0) {
                        $totalValue /= $groupValue;
                    }
                }

                $result[] = [
                    'name' => $s['name'],
                    'value' => $totalValue,
                    'color' => $s['color'] ?? null,
                ];
            } else {
                // Simple series
                $filtered = $this->applyConditions($pool, $s['conditions'] ?? [], $s['source_type'], 'AND');

                $operation = $s['operation'] ?? 'count';
                $targetCol = $s['target_col'] ?? null;

                $result[] = [
                    'name' => $s['name'],
                    'value' => $this->aggregatePool($filtered, $operation, $targetCol, $s['source_type']),
                    'color' => $s['color'] ?? null,
                ];
            }
        }

        return $result;
    }

    protected function calculateSeriesWithSql(array $s): ?float
    {
        // Don't use SQL if complex logic groups are present for now (can be optimized later)
        if (isset($s['logic_groups']) && ! empty($s['logic_groups'])) {
            return null;
        }

        // Don't use SQL if "in_roster" matching is used (requires cross-table logic)
        $conditions = $s['conditions'] ?? [];
        foreach ($conditions as $cond) {
            if (($cond['match_type'] ?? '') === 'in_roster') {
                return null;
            }
        }

        $query = $this->getSourceQuery($s['source_type'], $s['source_id'], $s);
        if (! $query) {
            return null;
        }

        $this->applyConditionsToQuery($query, $conditions, $s['source_type']);

        $operation = $s['operation'] ?? 'count';
        $targetCol = $s['target_col'] ?? null;

        return $this->aggregateQuery($query, $operation, $targetCol, $s['source_type']);
    }

    protected function getSourceQuery(string $type, $id, array $config = [])
    {
        if ($type === 'roster') {
            $roster = Roster::find($id);
            if (! $roster) {
                return null;
            }

            $query = RosterContent::query();

            if (! empty($config['section_ids'])) {
                $allSections = RosterSection::where('roster_id', $id)->get();
                $sectionIds = $this->getDescendantSectionIds($allSections, $config['section_ids']);
                $query->whereIn('section_id', $sectionIds);
            } else {
                $query->whereHas('section', function ($q) use ($id) {
                    $q->where('roster_id', $id);
                });
            }

            return $query;
        } elseif ($type === 'section') {
            $section = RosterSection::find($id);
            if (! $section) {
                return null;
            }

            $allSections = RosterSection::where('roster_id', $section->roster_id)->get();
            $sectionIds = $this->getDescendantSectionIds($allSections, [$section->id]);

            return RosterContent::whereIn('section_id', $sectionIds);
        } elseif ($type === 'database') {
            $db = FactionRecordDatabase::find($id);
            if (! $db) {
                return null;
            }

            return $db->entries()->where('is_active', true);
        }

        return null;
    }

    protected function applyConditionsToQuery($query, array $conditions, string $sourceType)
    {
        $dataKey = $sourceType === 'database' ? 'data' : 'content';

        foreach ($conditions as $cond) {
            $targetCol = $cond['target_col'] ?? null;
            if (! $targetCol) {
                continue;
            }

            $matchVal = $cond['match_value'] ?? null;
            $matchType = $cond['match_type'] ?? 'equals';

            // Special handling for RosterContent because column IDs vary by section
            if ($sourceType === 'roster' || $sourceType === 'section') {
                // If it's a roster-wide query, we might need a complex OR for different column IDs
                // But often targetCol is already a resolved ID if it came from the frontend.
                // If it's a name, we need to map it.
                // For simplicity now, we assume targetCol is the ID if it starts with 'col_'
                if (! str_starts_with($targetCol, 'col_')) {
                    // It's a name, we need to find all possible IDs for this name across relevant sections
                    // This is complex, so we fallback to collection for now if targetCol is not an ID
                    // (Actually, the frontend usually sends IDs)
                    if (str_contains($targetCol, ' ')) { // Likely a name
                        return null; // Force fallback
                    }
                }
            }

            $jsonPath = "{$dataKey}->{$targetCol}";

            switch ($matchType) {
                case 'exists':
                    $query->whereNotNull($jsonPath);
                    break;
                case 'equals':
                    $query->where($jsonPath, $matchVal);
                    break;
                case 'not_equals':
                    $query->where($jsonPath, '!=', $matchVal);
                    break;
                case 'contains':
                    $query->where($jsonPath, 'like', "%{$matchVal}%");
                    break;
                case 'is_null':
                    $query->whereNull($jsonPath);
                    break;
            }
        }
    }

    protected function aggregateQuery($query, string $operation, $targetCol, string $sourceType): float
    {
        if ($operation === 'count_unique' && $targetCol) {
            $dataKey = $sourceType === 'database' ? 'data' : 'content';

            return (float) $query->distinct("{$dataKey}->{$targetCol}")->count();
        }

        if ($operation === 'count' || ! $targetCol) {
            return (float) $query->count();
        }

        $dataKey = $sourceType === 'database' ? 'data' : 'content';
        $jsonPath = "{$dataKey}->{$targetCol}";

        switch ($operation) {
            case 'sum':
                return (float) $query->sum($jsonPath);
            case 'avg':
                return (float) round($query->avg($jsonPath), 2);
            case 'min':
                return (float) $query->min($jsonPath);
            case 'max':
                return (float) $query->max($jsonPath);
            default:
                return (float) $query->count();
        }
    }

    protected function aggregatePool(Collection $pool, string $operation, $targetCol, string $sourceType)
    {
        if ($operation === 'count_unique' && $targetCol) {
            $dataKey = $sourceType === 'database' ? 'data' : 'content';
            $values = $pool->map(function ($item) use ($dataKey, $targetCol) {
                $colId = $targetCol;
                if ($item instanceof RosterContent) {
                    $colId = $this->getRealColumnId($item->section_id, $targetCol);
                }
                $data = $item->$dataKey ?? [];
                $val = $data[$colId] ?? null;

                if (is_null($val) || $val === '') {
                    return null;
                }

                return is_array($val) ? json_encode($val) : (string) $val;
            })->filter(fn ($val) => ! is_null($val) && $val !== '');

            return $values->unique()->count();
        }

        if ($operation === 'count' || ! $targetCol) {
            return $pool->count();
        }

        $dataKey = $sourceType === 'database' ? 'data' : 'content';

        $values = $pool->map(function ($item) use ($dataKey, $targetCol) {
            $colId = $targetCol;
            if ($item instanceof RosterContent) {
                $colId = $this->getRealColumnId($item->section_id, $targetCol);
            }
            $data = $item->$dataKey ?? [];
            $val = $data[$colId] ?? 0;

            return is_numeric($val) ? (float) $val : 0;
        });

        switch ($operation) {
            case 'sum':
                return $values->sum();
            case 'avg':
                return $values->count() > 0 ? round($values->average(), 2) : 0;
            case 'min':
                return $values->count() > 0 ? $values->min() : 0;
            case 'max':
                return $values->count() > 0 ? $values->max() : 0;
            default:
                return $pool->count();
        }
    }

    protected function calculateGrouped(StatisticsWidget $widget, array $config, &$totalRowsProcessed): array
    {
        $groupBy = $config['group_by'];
        $sourceType = $groupBy['source_type'];
        $sourceId = $groupBy['source_id'];
        $colKey = $groupBy['column'];

        // Try SQL aggregation for grouping
        $sqlData = $this->calculateGroupedWithSql($groupBy, $config);
        if ($sqlData !== null) {
            return $sqlData;
        }

        $pool = $this->getSourcePool($sourceType, $sourceId, $totalRowsProcessed, $config);

        // Apply global filters if any
        if (isset($config['filters'])) {
            $pool = $this->applyConditions($pool, $config['filters'], $sourceType);
        }

        $dataKey = $sourceType === 'database' ? 'data' : 'content';

        $grouped = $pool->groupBy(function ($item) use ($dataKey, $colKey) {
            $data = $item->$dataKey ?? [];
            $val = $data[$colKey] ?? 'Unknown';

            return is_array($val) ? json_encode($val) : (string) $val;
        });

        $result = [];
        foreach ($grouped as $key => $items) {
            $result[] = [
                'name' => $key,
                'value' => $items->count(),
            ];
        }

        return $result;
    }

    protected function calculateGroupedWithSql(array $groupBy, array $config): ?array
    {
        $sourceType = $groupBy['source_type'];
        $sourceId = $groupBy['source_id'];
        $colKey = $groupBy['column'];

        // Fallback if colKey is not an ID for rosters
        if (($sourceType === 'roster' || $sourceType === 'section') && ! str_starts_with($colKey, 'col_')) {
            return null;
        }

        $query = $this->getSourceQuery($sourceType, $sourceId, $config);
        if (! $query) {
            return null;
        }

        if (isset($config['filters'])) {
            $this->applyConditionsToQuery($query, $config['filters'], $sourceType);
        }

        $dataKey = $sourceType === 'database' ? 'data' : 'content';
        $jsonPath = "{$dataKey}->{$colKey}";

        $results = $query->selectRaw("{$jsonPath} as group_key, count(*) as aggregate")
            ->groupBy('group_key')
            ->get();

        return $results->map(fn ($r) => [
            'name' => $r->group_key ?? 'Unknown',
            'value' => (int) $r->aggregate,
        ])->toArray();
    }

    protected function calculateTable(StatisticsWidget $widget, array $config, &$totalRowsProcessed): array
    {
        // Table can be multiple series as columns
        $series = $config['series'] ?? [];

        return $this->calculateSeries($widget, $series, $totalRowsProcessed);
    }

    protected function getSourcePool(string $type, $id, &$totalRowsProcessed, array $config = []): Collection
    {
        if ($type === 'roster') {
            $roster = Roster::find($id);
            if (! $roster) {
                return collect();
            }

            $allSections = RosterSection::where('roster_id', $id)->get();
            foreach ($allSections as $s) {
                $this->sectionsCache[$s->id] = $s;
            }

            $sectionIds = [];
            if (! empty($config['section_ids'])) {
                $sectionIds = $this->getDescendantSectionIds($allSections, $config['section_ids']);
            } else {
                $sectionIds = $allSections->pluck('id')->toArray();
            }

            $contents = RosterContent::whereIn('section_id', $sectionIds)->get();
            $totalRowsProcessed += $contents->count();

            return $contents;
        } elseif ($type === 'section') {
            $section = RosterSection::find($id);
            if (! $section) {
                return collect();
            }

            $allSections = RosterSection::where('roster_id', $section->roster_id)->get();
            foreach ($allSections as $s) {
                $this->sectionsCache[$s->id] = $s;
            }

            $sectionIds = $this->getDescendantSectionIds($allSections, [$section->id]);
            $contents = RosterContent::whereIn('section_id', $sectionIds)->get();
            $totalRowsProcessed += $contents->count();

            return $contents;
        } elseif ($type === 'database') {
            $db = FactionRecordDatabase::find($id);
            if (! $db) {
                return collect();
            }

            $entries = $db->entries()->where('is_active', true)->get();
            $totalRowsProcessed += $entries->count();

            return $entries;
        }

        return collect();
    }

    protected function getDescendantSectionIds(Collection $allSections, array $startSectionIds): array
    {
        $descendants = [];
        $toProcess = $startSectionIds;

        $groupedByParent = $allSections->groupBy('parent_id');

        while (! empty($toProcess)) {
            $currentId = array_shift($toProcess);
            $descendants[] = $currentId;

            if ($groupedByParent->has($currentId)) {
                foreach ($groupedByParent->get($currentId) as $child) {
                    if (! in_array($child->id, $descendants) && ! in_array($child->id, $toProcess)) {
                        $toProcess[] = $child->id;
                    }
                }
            }
        }

        return $descendants;
    }

    protected function getAllSectionIds($sections): array
    {
        $ids = [];
        foreach ($sections as $s) {
            $ids[] = $s->id;
            if ($s->children) {
                $ids = array_merge($ids, $this->getAllSectionIds($s->children));
            }
        }

        return $ids;
    }

    protected function evaluateCount(array $count, string $parentType, $parentId, &$totalRowsProcessed): float
    {
        if (empty($count['conditions']) || ! is_array($count['conditions'])) {
            return 0;
        }

        // Try SQL path first if there are no brackets and we are not in tests or DB is ready
        $hasBrackets = collect($count['conditions'])->contains(fn ($c) => ($c['brackets_open'] ?? 0) > 0 || ($c['brackets_close'] ?? 0) > 0);
        $hasInRoster = collect($count['conditions'])->contains(fn ($c) => ($c['match_type'] ?? '') === 'in_roster');

        if (! $hasBrackets && ! $hasInRoster) {
            try {
                $sqlValue = $this->evaluateCountWithSql($count, $parentType, $parentId);
                if ($sqlValue !== null) {
                    return $sqlValue;
                }
            } catch (\Throwable $e) {
                // Fallback to PHP if SQL fails (e.g. mock DB in tests)
            }
        }

        $result = 0;
        $stack = [];
        $isFirst = true;

        $applyOp = function ($base, $next, $op) {
            $base = (float) $base;
            $next = (float) $next;
            if ($op === '+') {
                return $base + $next;
            }
            if ($op === '-') {
                return $base - $next;
            }
            if ($op === '*') {
                return $base * $next;
            }
            if ($op === '/' && $next != 0) {
                return $base / $next;
            }
            if ($op === 'AND') {
                return min($base, $next);
            }
            if ($op === 'OR') {
                return max($base, $next);
            }

            return $next;
        };

        foreach ($count['conditions'] as $idx => $cond) {
            // 1. Handle Opening Brackets
            $openCount = (int) ($cond['brackets_open'] ?? 0);
            for ($i = 0; $i < $openCount; $i++) {
                $op = $isFirst ? '+' : ($cond['operator'] ?? ($cond['arithmetic_operator'] ?? '+'));
                $stack[] = ['result' => $result, 'operator' => $op];
                $result = 0;
                $isFirst = true;
            }

            $condMatchedValue = 0;

            if (($cond['type'] ?? '') === 'value') {
                $condMatchedValue = (float) ($cond['settings']['value'] ?? 0);
            } elseif (($cond['type'] ?? '') === 'count') {
                $targetCountId = $cond['settings']['count_id'] ?? null;
                if ($targetCountId) {
                    $otherCounts = [];
                    if ($parentType === 'roster') {
                        $roster = Roster::find($parentId);
                        $otherCounts = $roster ? ($roster->counts ?? []) : [];
                    } else {
                        $section = RosterSection::find($parentId);
                        $otherCounts = $section ? ($section->counts ?? []) : [];
                    }
                    $targetCount = collect($otherCounts)->first(fn ($c) => (string) ($c['id'] ?? '') === (string) $targetCountId);
                    if ($targetCount) {
                        $condMatchedValue = $this->evaluateCount($targetCount, $parentType, $parentId, $totalRowsProcessed);
                    }
                }
            } else {
                // Determine pool for this condition
                $scope = $cond['scope'] ?? 'default';
                $pool = collect();

                if ($scope === 'roster' && ! empty($cond['roster_id'])) {
                    $pool = $this->getSourcePool('roster', $cond['roster_id'], $totalRowsProcessed);
                } elseif ($scope === 'specific_sections' && ! empty($cond['section_ids'])) {
                    $sections = RosterSection::whereIn('id', $cond['section_ids'])->get();
                    if ($sections->isNotEmpty()) {
                        $firstSection = $sections->first();
                        $allSections = RosterSection::where('roster_id', $firstSection->roster_id)->get();
                        foreach ($allSections as $s) {
                            $this->sectionsCache[$s->id] = $s;
                        }
                        $sectionIds = $this->getDescendantSectionIds($allSections, $cond['section_ids']);
                    } else {
                        $sectionIds = [];
                    }
                    $pool = RosterContent::whereIn('section_id', $sectionIds)->get();
                    $totalRowsProcessed += $pool->count();
                } elseif ($scope === 'section' && $parentType === 'section') {
                    $pool = $this->getSourcePool('section', $parentId, $totalRowsProcessed);
                } else {
                    // Default behavior
                    if ($parentType === 'roster') {
                        $pool = $this->getSourcePool('roster', $parentId, $totalRowsProcessed);
                    } else {
                        $pool = $this->getSourcePool('section', $parentId, $totalRowsProcessed);
                    }
                }

                $filtered = $this->applyConditions($pool, $cond['filters'] ?? [$cond], 'roster');

                if (! empty($cond['settings']['count_unique']) && ! empty($cond['settings']['target_col'])) {
                    $targetColName = $cond['settings']['target_col'];
                    $dataKey = ($scope === 'database' || $parentType === 'database') ? 'data' : 'content';

                    $values = $filtered->map(function ($item) use ($dataKey, $targetColName) {
                        $colId = $targetColName;
                        if ($item instanceof RosterContent) {
                            $colId = $this->getRealColumnId($item->section_id, $targetColName);
                        }

                        $data = $item->$dataKey ?? [];
                        $val = $data[$colId] ?? null;

                        if (is_null($val) || $val === '') {
                            return null;
                        }

                        return is_array($val) ? json_encode($val) : (string) $val;
                    })->filter(fn ($val) => ! is_null($val) && $val !== '');

                    $condMatchedValue = $values->unique()->count();
                } else {
                    $condMatchedValue = $filtered->count();
                }
            }

            // 2. Apply arithmetic/logic
            if ($isFirst) {
                $result = $condMatchedValue;
                $isFirst = false;
            } else {
                $op = $cond['operator'] ?? ($cond['arithmetic_operator'] ?? '+');
                $result = $applyOp($result, $condMatchedValue, $op);
            }

            // 3. Handle Closing Brackets
            $closeCount = (int) ($cond['brackets_close'] ?? 0);
            for ($i = 0; $i < $closeCount; $i++) {
                if (! empty($stack)) {
                    $popped = array_pop($stack);
                    $result = $applyOp($popped['result'], $result, $popped['operator']);
                    $isFirst = false;
                }
            }
        }

        return (float) max(0, $result);
    }

    protected function evaluateCountWithSql(array $count, string $parentType, $parentId): ?float
    {
        $result = 0;
        $isFirst = true;

        foreach ($count['conditions'] as $cond) {
            $condMatchedValue = 0;

            if (($cond['type'] ?? '') === 'value') {
                $condMatchedValue = (float) ($cond['settings']['value'] ?? 0);
            } elseif (($cond['type'] ?? '') === 'count') {
                // Recursive call for nested counts - if it falls back to PHP, this will also return null
                return null;
            } else {
                $scope = $cond['scope'] ?? 'default';
                $query = null;

                if ($scope === 'roster' && ! empty($cond['roster_id'])) {
                    $query = $this->getSourceQuery('roster', $cond['roster_id']);
                } elseif ($scope === 'specific_sections' && ! empty($cond['section_ids'])) {
                    $sections = RosterSection::whereIn('id', $cond['section_ids'])->get();
                    if ($sections->isNotEmpty()) {
                        $firstSection = $sections->first();
                        $allSections = RosterSection::where('roster_id', $firstSection->roster_id)->get();
                        $sectionIds = $this->getDescendantSectionIds($allSections, $cond['section_ids']);
                        $query = RosterContent::whereIn('section_id', $sectionIds);
                    }
                } elseif ($scope === 'section' && $parentType === 'section') {
                    $query = $this->getSourceQuery('section', $parentId);
                } else {
                    if ($parentType === 'roster') {
                        $query = $this->getSourceQuery('roster', $parentId);
                    } else {
                        $query = $this->getSourceQuery('section', $parentId);
                    }
                }

                if (! $query) {
                    return null;
                }

                $this->applyConditionsToQuery($query, $cond['filters'] ?? [$cond], 'roster');

                if (! empty($cond['settings']['count_unique']) && ! empty($cond['settings']['target_col'])) {
                    $targetColName = $cond['settings']['target_col'];
                    $dataKey = ($scope === 'database' || $parentType === 'database') ? 'data' : 'content';
                    $condMatchedValue = (float) $query->distinct("{$dataKey}->{$targetColName}")->count();
                } else {
                    $condMatchedValue = (float) $query->count();
                }
            }

            if ($isFirst) {
                $result = $condMatchedValue;
                $isFirst = false;
            } else {
                $op = $cond['operator'] ?? ($cond['arithmetic_operator'] ?? '+');

                if ($op === '+') {
                    $result += $condMatchedValue;
                } elseif ($op === '-') {
                    $result -= $condMatchedValue;
                } elseif ($op === '*') {
                    $result *= $condMatchedValue;
                } elseif ($op === '/' && $condMatchedValue != 0) {
                    $result /= $condMatchedValue;
                } else {
                    return null;
                } // Logic ops (AND/OR) not implemented in this simple SQL builder
            }
        }

        return (float) max(0, $result);
    }

    protected function applyConditions(Collection $pool, array $conditions, string $sourceType, string $operator = 'AND'): Collection
    {
        if (empty($conditions)) {
            return $pool;
        }

        $dataKey = $sourceType === 'database' ? 'data' : 'content';

        if ($operator === 'OR') {
            return $pool->filter(function ($item) use ($conditions, $dataKey) {
                $data = $item->$dataKey ?? [];
                foreach ($conditions as $cond) {
                    if ($this->matchCondition($data, $cond, $item)) {
                        return true;
                    }
                }

                return false;
            });
        }

        // Default AND
        return $pool->filter(function ($item) use ($conditions, $dataKey) {
            $data = $item->$dataKey ?? [];
            foreach ($conditions as $cond) {
                if (! $this->matchCondition($data, $cond, $item)) {
                    return false;
                }
            }

            return true;
        });
    }

    protected function matchCondition(array $data, array $cond, $item = null): bool
    {
        $targetCol = $cond['target_col'] ?? null;
        if (! $targetCol) {
            return true;
        }

        if ($item instanceof RosterContent) {
            $targetCol = $this->getRealColumnId($item->section_id, $targetCol);
        }

        $val = $data[$targetCol] ?? null;
        $matchVal = $cond['match_value'] ?? null;
        $matchType = $cond['match_type'] ?? 'equals';

        switch ($matchType) {
            case 'exists':
                return ! empty($val);
            case 'equals':
                return strtolower((string) $val) === strtolower((string) $matchVal);
            case 'not_equals':
                return strtolower((string) $val) !== strtolower((string) $matchVal);
            case 'contains':
                return str_contains(strtolower((string) $val), strtolower((string) $matchVal));
            case 'is_null':
                return empty($val);
            case 'in_roster':
                if (empty($val)) {
                    return false;
                }
                $rosterId = $cond['relation_roster_id'] ?? null;
                $rosterCol = $cond['relation_roster_col'] ?? null;
                if (! $rosterId || ! $rosterCol) {
                    return false;
                }

                $rosterPool = $this->getRosterPoolCached($rosterId);

                $lookupKey = $rosterId.'_'.$rosterCol;
                if (! isset($this->rosterLookupsCache[$lookupKey])) {
                    $lookup = [];
                    foreach ($rosterPool as $row) {
                        $rowVal = strtolower((string) ($row->content[$rosterCol] ?? ''));
                        if ($rowVal !== '') {
                            if (! isset($lookup[$rowVal])) {
                                $lookup[$rowVal] = $row;
                            }
                        }
                    }
                    $this->rosterLookupsCache[$lookupKey] = $lookup;
                }

                $lookup = $this->rosterLookupsCache[$lookupKey];
                $normalizedVal = strtolower((string) $val);
                $matchingRow = $lookup[$normalizedVal] ?? null;

                if (! $matchingRow) {
                    return false;
                }

                $relationColumn = $cond['relation_column'] ?? null;
                if ($relationColumn) {
                    $relationValue = $cond['relation_value'] ?? null;
                    $relationMatchType = $cond['relation_match_type'] ?? 'equals';
                    $rowValToCheck = $matchingRow->content[$relationColumn] ?? null;

                    switch ($relationMatchType) {
                        case 'exists':
                            return ! empty($rowValToCheck);
                        case 'equals':
                            return strtolower((string) $rowValToCheck) === strtolower((string) $relationValue);
                        case 'not_equals':
                            return strtolower((string) $rowValToCheck) !== strtolower((string) $relationValue);
                        case 'contains':
                            return str_contains(strtolower((string) $rowValToCheck), strtolower((string) $relationValue));
                        case 'is_null':
                            return empty($rowValToCheck);
                        default:
                            return false;
                    }
                }

                return true;
            default:
                return false;
        }
    }
}
