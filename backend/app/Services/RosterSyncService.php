<?php

namespace App\Services;

use App\Events\RosterUpdated;
use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Models\FactionRecordEntry;
use App\Models\RosterContent;
use App\Models\RosterSection;
use Illuminate\Support\Collection;

class RosterSyncService
{
    /**
     * Re-sync all roster contents for a faction with their linked database entries.
     * This re-evaluates auto-applied checkboxes and tags.
     */
    public function syncFaction(Faction $faction): int
    {
        $rosters = $faction->rosters()->get()->keyBy('id');
        $sections = RosterSection::whereIn('roster_id', $rosters->keys())->get()->keyBy('id');
        $datasets = $faction->rosterDatasets()->get()->keyBy('id');
        $allDatabases = $faction->recordDatabases()->get();
        $dbEntries = $this->loadAllDbEntries($faction);

        $modified = 0;
        $modifiedRosterIds = [];
        $linkedRowsCache = [];

        RosterContent::whereIn('section_id', $sections->keys())
            ->whereNull('deleted_at')
            ->chunkById(200, function ($contents) use ($rosters, $sections, $datasets, $dbEntries, $allDatabases, &$modified, &$modifiedRosterIds, &$linkedRowsCache) {
                // \Log::info('Chunk size: ' . count($contents));
                foreach ($contents as $content) {
                    $section = $sections->get($content->section_id);
                    if (! $section) {
                        continue;
                    }

                    $roster = $rosters->get($section->roster_id);
                    if (! $roster) {
                        continue;
                    }

                    $columns = $this->resolveColumns($roster, $section);
                    $data = is_array($content->content) ? $content->content : [];
                    $linkedId = is_array($content->linked_id) ? $content->linked_id : [];
                    $linkedDisplay = is_array($content->linked_display) ? $content->linked_display : [];
                    $changed = false;

                    foreach ($columns as $col) {
                        $colId = $col['id'] ?? null;
                        if (! $colId) {
                            continue;
                        }

                        $dbId = $this->getLinkedDatabaseId($col, $datasets, $allDatabases);
                        if (! $dbId) {
                            continue;
                        }

                        $value = $data[$colId] ?? $linkedId[$colId] ?? $linkedDisplay[$colId] ?? null;
                        if ($value === null || $value === '') {
                            continue;
                        }

                        // Resolve roster data-link pointers
                        if (is_array($value) && isset($value['row_id'], $value['col_id'])) {
                            $targetRowId = $value['row_id'];

                            if (! isset($linkedRowsCache[$targetRowId])) {
                                $linked = RosterContent::find($targetRowId);
                                $linkedRowsCache[$targetRowId] = $linked ? $linked->content : null;
                            }

                            $linkedContent = $linkedRowsCache[$targetRowId];
                            $dispVal = (is_array($linkedContent))
                                ? ($linkedContent[$value['col_id']] ?? null)
                                : null;

                            if ($dispVal !== null && ! is_array($dispVal)) {
                                if (($linkedId[$colId] ?? null) !== $value || ($linkedDisplay[$colId] ?? null) !== (string) $dispVal || ($data[$colId] ?? null) !== (string) $dispVal) {
                                    $linkedId[$colId] = $value;
                                    $linkedDisplay[$colId] = (string) $dispVal;
                                    $data[$colId] = (string) $dispVal;
                                    $changed = true;
                                }
                            }
                            continue;
                        }

                        if (is_array($value)) {
                            continue;
                        }

                        // Look up entry by linked_id or stored value/name
                        $lookupId = $linkedId[$colId] ?? $value;
                        $entry = $dbEntries[$dbId][$lookupId] ?? null;

                        if (! $entry && isset($dbEntries[$dbId])) {
                            foreach ($dbEntries[$dbId] as $item) {
                                $name = $item->data['name'] ?? $item->data['character_name'] ?? $item->data['Character Name'] ?? null;
                                if ($name && strcasecmp(trim($name), trim((string) $value)) === 0) {
                                    $entry = $item;
                                    break;
                                }
                            }
                        }

                        if ($entry) {
                            $fieldId = $col['database_field_id'] ?? null;
                            $disp = ($fieldId && $fieldId !== 'id')
                                ? ($entry->data[$fieldId] ?? $entry->data['name'] ?? $entry->data['character_name'] ?? (string) $entry->entry_id)
                                : ($entry->data['name'] ?? $entry->data['character_name'] ?? $entry->data['Character Name'] ?? (string) $entry->entry_id);
                            
                            $disp = (string) $disp;

                            if (($linkedId[$colId] ?? null) !== $entry->entry_id || ($linkedDisplay[$colId] ?? null) !== $disp || ($data[$colId] ?? null) !== $disp) {
                                $linkedId[$colId] = $entry->entry_id;
                                $linkedDisplay[$colId] = $disp;
                                $data[$colId] = $disp;
                                $changed = true;
                            }
                        } else {
                            // Entry not found in active entries: preserve existing linked_display / string value if present
                            if (isset($linkedDisplay[$colId]) && $linkedDisplay[$colId] !== '') {
                                if (($data[$colId] ?? null) !== $linkedDisplay[$colId]) {
                                    $data[$colId] = $linkedDisplay[$colId];
                                    $changed = true;
                                }
                            } elseif (is_string($value) && ! is_numeric($value)) {
                                $linkedDisplay[$colId] = $value;
                                if (($data[$colId] ?? null) !== $value) {
                                    $data[$colId] = $value;
                                    $changed = true;
                                }
                            }
                        }

                        // Re-evaluate Checkboxes
                        if ($entry && isset($col['checkboxes']) && is_array($col['checkboxes'])) {
                            $key = "{$colId}_cb";
                            $current = is_array($data[$key] ?? null) ? $data[$key] : [];
                            $next = $this->evaluateAutoApplies($col['checkboxes'], $entry, $current);

                            if ($current !== $next) {
                                $data[$key] = array_values($next);
                                $changed = true;
                            }
                        }

                        // Re-evaluate Tags
                        if ($entry && isset($col['tags']) && is_array($col['tags'])) {
                            $key = "{$colId}_tags";
                            $current = is_array($data[$key] ?? null) ? $data[$key] : [];
                            $next = $this->evaluateAutoApplies($col['tags'], $entry, $current);

                            if ($current !== $next) {
                                $data[$key] = array_values($next);
                                $changed = true;
                            }
                        }
                    }

                    if ($changed) {
                        $content->updateQuietly([
                            'linked_id' => $linkedId,
                            'linked_display' => $linkedDisplay,
                            'content' => $data,
                        ]);
                        $modified++;
                        if (! in_array($roster->id, $modifiedRosterIds)) {
                            $modifiedRosterIds[] = $roster->id;
                        }
                    }
                }
            });

        if ($modified > 0) {
            Faction::invalidateRosterCache($faction->id);

            foreach ($modifiedRosterIds as $rosterId) {
                $roster = $rosters->get($rosterId);
                if ($roster) {
                    RosterUpdated::dispatch($roster);
                }
            }
        }

        return $modified;
    }

    private function evaluateAutoApplies(array $definitions, FactionRecordEntry $entry, array $current): array
    {
        $next = $current;
        $changed = false;

        foreach ($definitions as $def) {
            if (! is_array($def)) {
                continue;
            }

            $label = $def['label'] ?? null;
            if (! $label) {
                continue;
            }

            $autoApply = $def['auto_apply'] ?? null;
            $dbColumn = $def['auto_apply_field'] ?? ($autoApply['db_column'] ?? null);
            if (! $dbColumn) {
                continue;
            }

            $matchValue = $def['auto_apply_value'] ?? ($autoApply['match_value'] ?? null);

            $dbVal = ($dbColumn === 'id') ? (string) $entry->entry_id : ($entry->data[$dbColumn] ?? null);

            $isMatch = false;
            if ($matchValue !== null && $matchValue !== '') {
                $isMatch = $dbVal && str_contains(strtolower((string) $dbVal), strtolower((string) $matchValue));
            } else {
                $isMatch = ! empty($dbVal);
            }

            $has = in_array($label, $next);

            if ($isMatch && ! $has) {
                $next[] = $label;
                $changed = true;
            } elseif (! $isMatch && $has) {
                $next = array_diff($next, [$label]);
                $changed = true;
            }
        }

        return array_values($next);
    }

    private function getLinkedDatabaseId(array $col, Collection $datasetsById, Collection $allDatabases): ?int
    {
        $rawId = null;
        if (isset($col['linked_database_id']) && $col['linked_database_id']) {
            $rawId = $col['linked_database_id'];
        } elseif (isset($col['dataset_id']) && $col['dataset_id']) {
            $ds = $datasetsById->get($col['dataset_id']);
            if ($ds && $ds->record_database_id) {
                $rawId = $ds->record_database_id;
            }
        }

        if ($rawId) {
            return FactionRecordDatabase::resolveDatabaseId($rawId, $allDatabases);
        }

        return null;
    }

    private function loadAllDbEntries(Faction $faction): array
    {
        $dbIds = $faction->recordDatabases()->pluck('id')->toArray();
        if (empty($dbIds)) {
            return [];
        }

        $entries = FactionRecordEntry::whereIn('database_id', $dbIds)
            ->whereNull('deleted_at')
            ->get(['id', 'database_id', 'entry_id', 'data']);

        $grouped = [];
        foreach ($entries as $entry) {
            $grouped[$entry->database_id][$entry->entry_id] = $entry;
        }

        return $grouped;
    }

    private function resolveColumns($roster, $section): array
    {
        $useRosterCols = $section->use_roster_columns ?? true;
        if ($useRosterCols) {
            return is_array($roster->columns) ? $roster->columns : [];
        }
        $sectionCols = is_array($section->columns) ? $section->columns : [];

        return ! empty($sectionCols) ? $sectionCols : (is_array($roster->columns) ? $roster->columns : []);
    }
}
