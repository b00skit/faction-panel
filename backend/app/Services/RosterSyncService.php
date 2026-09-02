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

                        $value = $data[$colId] ?? null;

                        // If cell is empty or null, de-link and clean up auto-applied attributes
                        if ($value === null || $value === '') {
                            if (array_key_exists($colId, $linkedId)) {
                                unset($linkedId[$colId]);
                                $changed = true;
                            }
                            if (array_key_exists($colId, $linkedDisplay)) {
                                unset($linkedDisplay[$colId]);
                                $changed = true;
                            }

                            // Clean up auto-applied checkboxes
                            if (isset($col['checkboxes']) && is_array($col['checkboxes'])) {
                                $key = "{$colId}_cb";
                                $current = is_array($data[$key] ?? null) ? $data[$key] : [];
                                $next = $this->evaluateAutoApplies($col['checkboxes'], null, $current);
                                if ($current !== $next) {
                                    $data[$key] = array_values($next);
                                    $changed = true;
                                }
                            }

                            // Clean up auto-applied tags
                            if (isset($col['tags']) && is_array($col['tags'])) {
                                $key = "{$colId}_tags";
                                $current = is_array($data[$key] ?? null) ? $data[$key] : [];
                                $next = $this->evaluateAutoApplies($col['tags'], null, $current);
                                if ($current !== $next) {
                                    $data[$key] = array_values($next);
                                    $changed = true;
                                }
                            }

                            continue;
                        }

                        // Resolve roster data-link pointers
                        $pointerVal = null;
                        if (is_array($value) && isset($value['row_id'], $value['col_id'])) {
                            $pointerVal = $value;
                            $targetRowId = $value['row_id'];

                            if (! isset($linkedRowsCache[$targetRowId])) {
                                $linked = RosterContent::find($targetRowId);
                                $linkedRowsCache[$targetRowId] = $linked ? $linked->content : null;
                            }

                            $linkedContent = $linkedRowsCache[$targetRowId];
                            $dispVal = (is_array($linkedContent))
                                ? ($linkedContent[$value['col_id']] ?? null)
                                : null;

                            $value = $dispVal;
                        }

                        if ($value === null || $value === '' || is_array($value)) {
                            if (array_key_exists($colId, $linkedId) && ! $pointerVal) {
                                unset($linkedId[$colId]);
                                $changed = true;
                            } elseif ($pointerVal && ($linkedId[$colId] ?? null) !== $pointerVal) {
                                $linkedId[$colId] = $pointerVal;
                                $changed = true;
                            }
                            if (array_key_exists($colId, $linkedDisplay)) {
                                unset($linkedDisplay[$colId]);
                                $changed = true;
                            }

                            continue;
                        }

                        // Look up active entry in dbEntries
                        $entry = null;
                        if (is_numeric($value) && filter_var($value, FILTER_VALIDATE_INT) !== false) {
                            $entry = $dbEntries[$dbId][(int) $value] ?? null;
                        }

                        if (! $entry && isset($dbEntries[$dbId])) {
                            foreach ($dbEntries[$dbId] as $item) {
                                $name = $item->data['name'] ?? $item->data['character_name'] ?? $item->data['Character Name'] ?? null;
                                if ($name && strcasecmp(trim((string) $name), trim((string) $value)) === 0) {
                                    $entry = $item;
                                    break;
                                }
                                $fieldId = $col['database_field_id'] ?? null;
                                if ($fieldId && isset($item->data[$fieldId])) {
                                    if (strcasecmp(trim((string) $item->data[$fieldId]), trim((string) $value)) === 0) {
                                        $entry = $item;
                                        break;
                                    }
                                }
                            }
                        }

                        if ($entry) {
                            $fieldId = $col['database_field_id'] ?? null;
                            $disp = ($fieldId && $fieldId !== 'id')
                                ? ($entry->data[$fieldId] ?? $entry->data['name'] ?? $entry->data['character_name'] ?? (string) $entry->entry_id)
                                : ($entry->data['name'] ?? $entry->data['character_name'] ?? $entry->data['Character Name'] ?? (string) $entry->entry_id);

                            $disp = (string) $disp;
                            $targetLinkedId = $pointerVal ?: (int) $entry->entry_id;

                            if (($linkedId[$colId] ?? null) !== $targetLinkedId || ($linkedDisplay[$colId] ?? null) !== $disp || ($data[$colId] ?? null) !== $disp) {
                                $linkedId[$colId] = $targetLinkedId;
                                $linkedDisplay[$colId] = $disp;
                                $data[$colId] = $disp;
                                $changed = true;
                            }
                        } else {
                            // Entry not found in active entries: de-link it!
                            if (is_numeric($value)) {
                                $fallbackName = $linkedDisplay[$colId] ?? (string) $value;
                                if (($data[$colId] ?? null) !== $fallbackName) {
                                    $data[$colId] = $fallbackName;
                                    $changed = true;
                                }
                            }
                            if (array_key_exists($colId, $linkedId) && ! $pointerVal) {
                                unset($linkedId[$colId]);
                                $changed = true;
                            } elseif ($pointerVal && ($linkedId[$colId] ?? null) !== $pointerVal) {
                                $linkedId[$colId] = $pointerVal;
                                $changed = true;
                            }
                            if (array_key_exists($colId, $linkedDisplay)) {
                                unset($linkedDisplay[$colId]);
                                $changed = true;
                            }
                        }

                        // Re-evaluate Checkboxes
                        if (isset($col['checkboxes']) && is_array($col['checkboxes'])) {
                            $key = "{$colId}_cb";
                            $current = is_array($data[$key] ?? null) ? $data[$key] : [];
                            $next = $this->evaluateAutoApplies($col['checkboxes'], $entry, $current);

                            if ($current !== $next) {
                                $data[$key] = array_values($next);
                                $changed = true;
                            }
                        }

                        // Re-evaluate Tags
                        if (isset($col['tags']) && is_array($col['tags'])) {
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

    private function evaluateAutoApplies(array $definitions, ?FactionRecordEntry $entry, array $current): array
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

            $isMatch = false;
            if ($entry) {
                $dbVal = ($dbColumn === 'id') ? (string) $entry->entry_id : ($entry->data[$dbColumn] ?? null);

                if ($matchValue !== null && $matchValue !== '') {
                    $isMatch = $dbVal && str_contains(strtolower((string) $dbVal), strtolower((string) $matchValue));
                } else {
                    $isMatch = ! empty($dbVal);
                }
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
