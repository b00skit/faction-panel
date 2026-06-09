<?php

namespace App\Services;

use App\Models\Faction;
use App\Models\FactionRecordEntry;
use App\Models\RosterContent;
use App\Models\RosterFlag;
use App\Models\RosterSection;
use Illuminate\Support\Collection;

class RosterFlagService
{
    /**
     * Recalculate all flag matches for the given flag across every roster content row
     * that belongs to a column using this flag.
     *
     * The flag name is written into / removed from the column's `{colId}_tags` list
     * (or `{colId}_cb` if no tags array exists on the column but a checkboxes array does).
     *
     * @return int Number of content rows that were modified.
     */
    public function recalculate(RosterFlag $flag): int
    {
        $faction = $flag->faction;

        // ── 1. Load all rosters / sections / contents for this faction ──────────
        $rosters = $faction->rosters()->get()->keyBy('id');
        $sections = RosterSection::whereIn('roster_id', $rosters->keys())->get();
        $sectionsById = $sections->keyBy('id');
        $datasets = $faction->rosterDatasets()->get()->keyBy('id');

        $contents = RosterContent::whereIn('section_id', $sections->pluck('id'))
            ->whereNull('deleted_at')
            ->get();

        // ── 2. Build a value-resolution cache (content_id → colId → normalised string) ──
        // We need the database entries to resolve raw numeric entry_ids to display labels.
        $allDbEntries = $this->loadAllDbEntries($faction);

        $cache = $this->buildResolutionCache($contents, $rosters, $sectionsById, $allDbEntries, $datasets);

        // ── 3. Determine which columns use this flag ─────────────────────────────
        // A column "uses" this flag when it has an `enabled_flags` array containing
        // the flag id, OR when the column has `flag_settings` referencing this flag.
        // More broadly, any column can potentially show a flag – we'll evaluate for
        // all columns that have flag_settings keys for this flag OR any column that
        // has the flag id in its `enabled_flags`.
        // For `exists_elsewhere` we need to evaluate per-column, so we iterate all cols.

        $modified = 0;

        // Gather all contents indexed for pool lookups
        $contentsById = $contents->keyBy('id');

        foreach ($contents as $content) {
            $section = $sectionsById->get($content->section_id);
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

                // Only process columns that actually reference this flag
                $enabledFlags = $col['enabled_flags'] ?? [];
                $flagSettings = $col['flag_settings'] ?? [];
                $colUsesFlag = in_array($flag->id, array_map('intval', (array) $enabledFlags))
                              || isset($flagSettings[$flag->id]);

                if (! $colUsesFlag) {
                    continue;
                }

                $isMatch = $this->evaluateFlag(
                    $flag,
                    $col,
                    $content,
                    $data,
                    $cache,
                    $contents,
                    $contentsById,
                    $rosters,
                    $sectionsById
                );

                // Decide whether to write into _tags or _cb
                $hasTags = isset($col['tags']) && is_array($col['tags']);
                $hasCbs = isset($col['checkboxes']) && is_array($col['checkboxes']);

                if ($hasTags) {
                    $key = "{$colId}_tags";
                    $current = array_values(is_array($data[$key] ?? null) ? $data[$key] : []);
                    $has = in_array($flag->name, $current);

                    if ($isMatch && ! $has) {
                        $current[] = $flag->name;
                        $data[$key] = array_values($current);
                        $changed = true;
                    } elseif (! $isMatch && $has) {
                        $data[$key] = array_values(array_diff($current, [$flag->name]));
                        $changed = true;
                    }
                } elseif ($hasCbs) {
                    $key = "{$colId}_cb";
                    $current = array_values(is_array($data[$key] ?? null) ? $data[$key] : []);
                    $has = in_array($flag->name, $current);

                    if ($isMatch && ! $has) {
                        $current[] = $flag->name;
                        $data[$key] = array_values($current);
                        $changed = true;
                    } elseif (! $isMatch && $has) {
                        $data[$key] = array_values(array_diff($current, [$flag->name]));
                        $changed = true;
                    }
                }
                // If neither tags nor checkboxes exist on the column definition, we
                // still need somewhere to persist the flag. Fall back to _tags.
                else {
                    $key = "{$colId}_tags";
                    $current = array_values(is_array($data[$key] ?? null) ? $data[$key] : []);
                    $has = in_array($flag->name, $current);

                    if ($isMatch && ! $has) {
                        $current[] = $flag->name;
                        $data[$key] = array_values($current);
                        $changed = true;
                    } elseif (! $isMatch && $has) {
                        $data[$key] = array_values(array_diff($current, [$flag->name]));
                        $changed = true;
                    }
                }
            }

            if ($changed) {
                // Save without triggering full Auditable re-audit on every row
                $content->updateQuietly(['content' => $data]);
                $modified++;
            }
        }

        return $modified;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    /**
     * Evaluate a single flag rule set against a specific content row / column.
     */
    private function evaluateFlag(
        RosterFlag $flag,
        array $col,
        RosterContent $row,
        array $data,
        array $cache,
        Collection $allContents,
        Collection $contentsById,
        Collection $rostersById,
        Collection $sectionsById
    ): bool {
        if (empty($flag->rules)) {
            return false;
        }

        $colId = $col['id'];
        $value = $cache[$row->id][$colId] ?? '';

        if ($value === '') {
            return false;
        }

        foreach ($flag->rules as $rule) {
            $type = $rule['type'] ?? '';

            $matched = match ($type) {
                'equals' => $value === strtolower(trim((string) ($rule['value'] ?? ''))),
                'not_equals' => $value !== strtolower(trim((string) ($rule['value'] ?? ''))),
                'contains' => str_contains($value, strtolower(trim((string) ($rule['value'] ?? '')))),

                'exists_elsewhere' => $this->evaluateExistsElsewhere(
                    $flag, $rule, $col, $row, $value, $allContents, $cache, $rostersById, $sectionsById
                ),

                // Other rule types are purely client-side (dataset lookups etc.) and not
                // trivially replicable without the full dataset option lists.
                // We skip them to avoid false positives / negatives on recalculate.
                default => false,
            };

            if ($matched) {
                return true;
            }
        }

        return false;
    }

    /**
     * Evaluate the `exists_elsewhere` rule.
     */
    private function evaluateExistsElsewhere(
        RosterFlag $flag,
        array $rule,
        array $col,
        RosterContent $row,
        string $value,
        Collection $allContents,
        array $cache,
        Collection $rostersById,
        Collection $sectionsById
    ): bool {
        // Skip placeholder values
        if ($value === '' || $value === '-' || str_starts_with($value, '?')) {
            return false;
        }

        $scope = $rule['scope'] ?? 'section';

        $pool = match ($scope) {
            'global' => $allContents,
            'roster' => $allContents->filter(function ($c) use ($row, $sectionsById) {
                $rowSection = $sectionsById->get($row->section_id);
                $otherSection = $sectionsById->get($c->section_id);

                return $rowSection && $otherSection
                    && $otherSection->roster_id === $rowSection->roster_id;
            }),
            default => $allContents->filter(fn ($c) => $c->section_id === $row->section_id),
        };

        $excludedRosterIds = array_map('intval', (array) ($flag->excluded_roster_ids ?? []));
        $excludedSectionIds = array_map(
            'intval',
            (array) ($col['flag_settings'][$flag->id]['excluded_section_ids'] ?? [])
        );

        $targetCol = $rule['target_col'] ?? null;

        foreach ($pool as $other) {
            if ((int) $other->id === (int) $row->id) {
                continue;
            }

            // Apply roster exclusion
            $otherSection = $sectionsById->get($other->section_id);
            if ($otherSection && in_array((int) $otherSection->roster_id, $excludedRosterIds, true)) {
                continue;
            }
            if (in_array((int) $other->section_id, $excludedSectionIds, true)) {
                continue;
            }

            if ($targetCol) {
                $otherVal = $cache[$other->id][$targetCol] ?? '';
                if ($otherVal === $value && $otherVal !== '' && $otherVal !== '-' && ! str_starts_with($otherVal, '?')) {
                    return true;
                }
            } else {
                $otherContent = is_array($other->content) ? $other->content : [];
                foreach (array_keys($otherContent) as $tColId) {
                    if (str_ends_with($tColId, '_cb') || str_ends_with($tColId, '_tags')) {
                        continue;
                    }
                    $otherVal = $cache[$other->id][$tColId] ?? '';
                    if ($otherVal === $value && $otherVal !== '' && $otherVal !== '-' && ! str_starts_with($otherVal, '?')) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Build a two-level cache: cache[contentId][colId] = normalised string value.
     * Resolves numeric entry-id values to their display labels using DB entries.
     */
    private function buildResolutionCache(
        Collection $contents,
        Collection $rostersById,
        Collection $sectionsById,
        array $allDbEntriesByDbId,    // [dbId => [entryId => entry]]
        Collection $datasetsById
    ): array {
        $cache = [];

        // Index contents by id for roster-data-link resolution
        $contentsById = $contents->keyBy('id');

        foreach ($contents as $content) {
            $section = $sectionsById->get($content->section_id);
            if (! $section) {
                continue;
            }
            $roster = $rostersById->get($section->roster_id);
            if (! $roster) {
                continue;
            }

            $columns = $this->resolveColumns($roster, $section);
            $data = is_array($content->content) ? $content->content : [];

            $cache[$content->id] = [];

            foreach ($columns as $col) {
                $colId = $col['id'] ?? null;
                if (! $colId) {
                    continue;
                }
                if (str_ends_with($colId, '_cb') || str_ends_with($colId, '_tags')) {
                    continue;
                }

                $rawVal = $data[$colId] ?? null;

                // Resolve roster data-link pointers
                if (is_array($rawVal) && isset($rawVal['row_id'], $rawVal['col_id'])) {
                    $linked = $contentsById->get($rawVal['row_id']);
                    $rawVal = ($linked && is_array($linked->content))
                        ? ($linked->content[$rawVal['col_id']] ?? null)
                        : null;
                }

                $resolved = $this->resolveDisplayValue($rawVal, $col, $allDbEntriesByDbId, $datasetsById);
                $cache[$content->id][$colId] = strtolower(trim($resolved));
            }
        }

        return $cache;
    }

    /**
     * Resolve a raw cell value to a human-readable string, mirroring
     * the frontend's `getResolvedDisplayValue`.
     */
    private function resolveDisplayValue(mixed $rawVal, array $col, array $allDbEntriesByDbId, Collection $datasetsById): string
    {
        if ($rawVal === null || $rawVal === '') {
            return '';
        }

        if (is_array($rawVal)) {
            return '';
        }

        $dbId = $col['linked_database_id'] ?? null;

        // Fallback: Check if column is linked to a database via a dataset
        if (! $dbId && isset($col['dataset_id'])) {
            $dataset = $datasetsById->get($col['dataset_id']);
            if ($dataset && $dataset->record_database_id) {
                $dbId = $dataset->record_database_id;
            }
        }

        // Column linked directly or via dataset to a record database
        if ($dbId && isset($allDbEntriesByDbId[$dbId])) {
            $entry = $allDbEntriesByDbId[$dbId][$rawVal] ?? null;
            if ($entry) {
                $fieldId = $col['database_field_id'] ?? null;
                if ($fieldId && $fieldId !== 'id') {
                    return (string) ($entry['data'][$fieldId] ?? $rawVal);
                }

                // Default showcase field = first text-like field or 'name'
                return (string) ($entry['data']['name'] ?? $entry['data']['character_name'] ?? $rawVal);
            }
        }

        return (string) $rawVal;
    }

    /**
     * Load all active database entries grouped by database_id, then by entry_id.
     * Returns [dbId => [entryId => entry]].
     */
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

    /**
     * Determine effective column list for a section/roster combo.
     */
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
