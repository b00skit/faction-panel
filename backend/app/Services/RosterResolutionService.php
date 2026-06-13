<?php

namespace App\Services;

use App\Models\FactionRecordDatabase;
use App\Models\RosterContent;
use App\Models\RosterDataset;

class RosterResolutionService
{
    protected static $dbCache = [];

    protected static $datasetCache = [];

    /**
     * Resolves the string display value of a roster content cell.
     * Recursively follows linked roster cells and resolves database/dataset entry IDs.
     */
    public static function resolveCellValue(RosterContent $content, string $colId, int $depth = 0)
    {
        if ($depth > 5) {
            return '-';
        }

        $section = $content->section;
        if (! $section) {
            return $content->content[$colId] ?? '';
        }
        $roster = $section->roster;
        if (! $roster) {
            return $content->content[$colId] ?? '';
        }

        $columns = $section->use_roster_columns ? ($roster->columns ?? []) : ($section->columns ?: ($roster->columns ?? []));
        $col = collect($columns)->firstWhere('id', $colId);

        $val = $content->content[$colId] ?? null;
        if ($val === null || $val === '') {
            return '';
        }

        if (! $col) {
            return is_scalar($val) ? (string) $val : '';
        }

        $colType = $col['type'] ?? '';

        // 1. Handle linked_roster_data (cross-roster links)
        if (str_contains($colType, 'linked_roster_data')) {
            if (is_array($val) && isset($val['row_id']) && isset($val['col_id'])) {
                $linkedContent = RosterContent::with('section.roster')->find($val['row_id']);
                if ($linkedContent) {
                    return self::resolveCellValue($linkedContent, $val['col_id'], $depth + 1);
                }

                return '-';
            }
        }

        // 2. Handle database / dataset links
        $dbId = null;
        $faction = $roster->faction;
        $factionDatabases = $faction ? $faction->recordDatabases : collect();

        if (isset($col['linked_database_id']) && $col['linked_database_id']) {
            $dbId = FactionRecordDatabase::resolveDatabaseId($col['linked_database_id'], $factionDatabases);
        } elseif (isset($col['dataset_id']) && $col['dataset_id']) {
            $datasetId = $col['dataset_id'];
            if (! array_key_exists($datasetId, self::$datasetCache)) {
                self::$datasetCache[$datasetId] = RosterDataset::find($datasetId);
            }
            $dataset = self::$datasetCache[$datasetId];
            if ($dataset && $dataset->record_database_id) {
                $dbId = FactionRecordDatabase::resolveDatabaseId($dataset->record_database_id, $factionDatabases);
            }
        }

        if ($dbId) {
            if (! array_key_exists($dbId, self::$dbCache)) {
                self::$dbCache[$dbId] = FactionRecordDatabase::with(['entries' => function ($query) {
                    $query->where('is_active', true);
                }])->find($dbId);
            }
            $db = self::$dbCache[$dbId];

            if ($db && is_numeric($val) && filter_var($val, FILTER_VALIDATE_INT) !== false) {
                $entry = $db->entries->firstWhere('entry_id', $val);
                if ($entry) {
                    $fieldId = $col['database_field_id'] ?? $db->database_structure[0]['id'] ?? 'id';
                    $resolvedVal = ($fieldId === 'id') ? $entry->entry_id : ($entry->data[$fieldId] ?? $val);

                    return is_scalar($resolvedVal) ? (string) $resolvedVal : '';
                }
            }
        } elseif (isset($col['dataset_id']) && $col['dataset_id']) {
            $datasetId = $col['dataset_id'];
            if (! array_key_exists($datasetId.'_options', self::$datasetCache)) {
                self::$datasetCache[$datasetId.'_options'] = RosterDataset::with('options')->find($datasetId);
            }
            $dataset = self::$datasetCache[$datasetId.'_options'];
            if ($dataset && is_numeric($val) && filter_var($val, FILTER_VALIDATE_INT) !== false) {
                $option = $dataset->options->firstWhere('id', $val);
                if ($option) {
                    return (string) $option->value;
                }
            }
        }

        return is_scalar($val) ? (string) $val : '';
    }

    /**
     * Resolves and populates display labels and values for a hierarchy node's slots.
     */
    public static function resolveNodeSlots($node, $rosterContents = null)
    {
        if (! empty($node->roster_sync_config['enabled']) && ! empty($node->roster_sync_config['section_id'])) {
            $secId = (int) $node->roster_sync_config['section_id'];
            $start = isset($node->roster_sync_config['row_start']) ? (int) $node->roster_sync_config['row_start'] : 1;
            $end = isset($node->roster_sync_config['row_end']) ? (int) $node->roster_sync_config['row_end'] : null;
            $keyCol = ! empty($node->roster_sync_config['key_col']) ? $node->roster_sync_config['key_col'] : 'rank';
            $valueCol = ! empty($node->roster_sync_config['value_col']) ? $node->roster_sync_config['value_col'] : 'name';

            $rows = RosterContent::where('section_id', $secId)->orderBy('order')->orderBy('id')->get();
            $offset = max(0, $start - 1);
            $limit = $end ? ($end - $start + 1) : null;
            if ($limit !== null) {
                $rows = $rows->slice($offset, $limit);
            } else {
                $rows = $rows->slice($offset);
            }

            $dynamicSlots = [];
            foreach ($rows as $row) {
                $labelColor = $node->roster_sync_config['label_color'] ?? null;
                $labelBold = isset($node->roster_sync_config['label_bold']) ? (bool) $node->roster_sync_config['label_bold'] : true;
                $valueColor = $node->roster_sync_config['value_color'] ?? null;
                $valueBold = isset($node->roster_sync_config['value_bold']) ? (bool) $node->roster_sync_config['value_bold'] : true;

                $dynamicSlots[] = [
                    'id' => 'auto_'.$row->id,
                    'roster_content_id' => $row->id,
                    'label' => self::resolveCellValue($row, $keyCol),
                    'value' => self::resolveCellValue($row, $valueCol),
                    'label_color' => $labelColor,
                    'label_bold' => $labelBold,
                    'value_color' => $valueColor,
                    'value_bold' => $valueBold,
                    'roster_content' => [
                        'id' => $row->id,
                        'section_id' => $row->section_id,
                        'content' => $row->content,
                        'color' => $row->color,
                    ],
                ];
            }
            $node->slots = $dynamicSlots;
        } else {
            $slots = $node->slots ?? [];
            $resolvedSlots = [];

            if ($rosterContents === null) {
                $rosterContentIds = [];
                foreach ($slots as $slot) {
                    if (! empty($slot['roster_content_id'])) {
                        $rosterContentIds[] = $slot['roster_content_id'];
                    }
                }

                if (! empty($rosterContentIds)) {
                    $rosterContents = RosterContent::whereIn('id', array_unique($rosterContentIds))
                        ->with('section.roster')
                        ->get()
                        ->keyBy('id');
                } else {
                    $rosterContents = collect();
                }
            }

            foreach ($slots as $slot) {
                if (! empty($slot['roster_content_id']) && isset($rosterContents[$slot['roster_content_id']])) {
                    $rc = $rosterContents[$slot['roster_content_id']];
                    $slot['roster_content'] = [
                        'id' => $rc->id,
                        'section_id' => $rc->section_id,
                        'content' => $rc->content,
                        'color' => $rc->color,
                    ];

                    // Resolve label and value
                    $roster = $rc->section->roster;
                    $nameColId = 'name';
                    $rankColId = 'rank';
                    if ($roster && $roster->columns) {
                        $columns = $roster->columns;
                        $nameCol = collect($columns)->first(fn ($c) => ($c['id'] ?? '') === 'name' || str_contains(strtolower($c['name'] ?? ''), 'name'));
                        $rankCol = collect($columns)->first(fn ($c) => ($c['id'] ?? '') === 'rank' || str_contains(strtolower($c['name'] ?? ''), 'rank') || str_contains(strtolower($c['name'] ?? ''), 'role'));
                        if ($nameCol) {
                            $nameColId = $nameCol['id'];
                        }
                        if ($rankCol) {
                            $rankColId = $rankCol['id'];
                        }
                    }

                    $slot['label'] = self::resolveCellValue($rc, $rankColId);
                    $slot['value'] = self::resolveCellValue($rc, $nameColId);
                }
                $resolvedSlots[] = $slot;
            }
            $node->slots = $resolvedSlots;
        }

        return $node;
    }
}
