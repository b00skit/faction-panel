<?php

namespace App\Services;

use App\Events\RosterUpdated;
use App\Models\Faction;
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
        $dbEntries = $this->loadAllDbEntries($faction);

        $modified = 0;
        $modifiedRosterIds = [];
        $linkedRowsCache = [];

        RosterContent::whereIn('section_id', $sections->keys())
            ->whereNull('deleted_at')
            ->chunkById(200, function ($contents) use ($rosters, $sections, $datasets, $dbEntries, &$modified, &$modifiedRosterIds, &$linkedRowsCache) {
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
                    $changed = false;

                    foreach ($columns as $col) {
                        $colId = $col['id'] ?? null;
                        if (! $colId) {
                            continue;
                        }

                        $dbId = $this->getLinkedDatabaseId($col, $datasets);
                        if (! $dbId) {
                            continue;
                        }

                        $value = $data[$colId] ?? null;
                        if (! $value) {
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
                            $value = (is_array($linkedContent))
                                ? ($linkedContent[$value['col_id']] ?? null)
                                : null;
                        }

                        if ($value === null || is_array($value)) {
                            continue;
                        }

                        $entry = $dbEntries[$dbId][$value] ?? null;
                        if (! $entry) {
                            // \Log::info("Entry not found for dbId $dbId and value $value");
                            continue;
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
                        $content->updateQuietly(['content' => $data]);
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

    private function getLinkedDatabaseId(array $col, Collection $datasetsById): ?int
    {
        if (isset($col['linked_database_id']) && $col['linked_database_id']) {
            return (int) $col['linked_database_id'];
        }
        if (isset($col['dataset_id']) && $col['dataset_id']) {
            $ds = $datasetsById->get($col['dataset_id']);
            if ($ds && $ds->record_database_id) {
                return (int) $ds->record_database_id;
            }
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
