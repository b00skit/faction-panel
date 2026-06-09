<?php

namespace App\Http\Controllers;

use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Models\Roster;
use App\Models\RosterContent;
use App\Models\RosterDataset;
use App\Models\RosterRevision;
use App\Models\RosterSection;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;

class RosterController extends Controller
{
    private function cleanUpOrphanedData($target, array $columns)
    {
        $oldColumns = $target->getOriginal('columns') ?? [];
        if (! is_array($oldColumns)) {
            $oldColumns = [];
        }

        // Map of oldLabel => newLabel for renames, per column
        // Also tracks if we need a full sweep for color/icon (though those are usually handled by rendering if we don't store them in content)
        // Actually, content ONLY stores the labels (strings).
        // So if a label changes, we MUST update the strings in the content JSON.

        $renameMap = [];
        $validMap = [];
        $clearMap = [];

        foreach ($columns as $newCol) {
            $colId = $newCol['id'];
            $oldCol = collect($oldColumns)->firstWhere('id', $colId);

            $newCbLabels = collect($newCol['checkboxes'] ?? [])->map(fn ($cb) => is_string($cb) ? $cb : ($cb['label'] ?? null))->filter()->toArray();
            $newTagLabels = collect($newCol['tags'] ?? [])->map(fn ($tag) => is_string($tag) ? $tag : ($tag['label'] ?? null))->filter()->toArray();

            $validMap[$colId] = [
                'checkboxes' => $newCbLabels,
                'tags' => $newTagLabels,
            ];

            if ($oldCol) {
                // If the type changed, we should clear the data for this column
                if (($oldCol['type'] ?? null) !== ($newCol['type'] ?? null)) {
                    $clearMap[] = $colId;
                }

                $oldCbs = $oldCol['checkboxes'] ?? [];
                $newCbs = $newCol['checkboxes'] ?? [];

                // If the count is the same, we check for index-based renames
                if (count($oldCbs) === count($newCbs)) {
                    foreach ($oldCbs as $idx => $oldCb) {
                        $oldLabel = is_string($oldCb) ? $oldCb : ($oldCb['label'] ?? null);
                        $newLabel = is_string($newCbs[$idx]) ? $newCbs[$idx] : ($newCbs[$idx]['label'] ?? null);
                        if ($oldLabel && $newLabel && $oldLabel !== $newLabel) {
                            $renameMap[$colId]['checkboxes'][$oldLabel] = $newLabel;
                        }
                    }
                }

                $oldTags = $oldCol['tags'] ?? [];
                $newTags = $newCol['tags'] ?? [];
                if (count($oldTags) === count($newTags)) {
                    foreach ($oldTags as $idx => $oldTag) {
                        $oldLabel = is_string($oldTag) ? $oldTag : ($oldTag['label'] ?? null);
                        $newLabel = is_string($newTags[$idx]) ? $newTags[$idx] : ($newTags[$idx]['label'] ?? null);
                        if ($oldLabel && $newLabel && $oldLabel !== $newLabel) {
                            $renameMap[$colId]['tags'][$oldLabel] = $newLabel;
                        }
                    }
                }
            }
        }

        // Get all content for this target
        $contents = [];
        if ($target instanceof Roster) {
            $sectionIds = RosterSection::where('roster_id', $target->id)
                ->where(function ($q) {
                    $q->where('use_roster_columns', true)->orWhereNull('columns');
                })
                ->pluck('id');
            $contents = RosterContent::whereIn('section_id', $sectionIds)->get();
        } else {
            $contents = RosterContent::where('section_id', $target->id)->get();
        }

        foreach ($contents as $content) {
            $data = $content->content;
            if (! $data || ! is_array($data)) {
                continue;
            }

            $changed = false;
            foreach ($clearMap as $colId) {
                if (isset($data[$colId])) {
                    unset($data[$colId]);
                    $changed = true;
                }
            }

            foreach ($validMap as $colId => $valids) {
                // Handle Checkboxes
                $cbKey = "{$colId}_cb";
                if (isset($data[$cbKey]) && is_array($data[$cbKey])) {
                    $original = $data[$cbKey];

                    // 1. Apply renames
                    if (isset($renameMap[$colId]['checkboxes'])) {
                        $data[$cbKey] = array_map(function ($val) use ($renameMap, $colId) {
                            return $renameMap[$colId]['checkboxes'][$val] ?? $val;
                        }, $data[$cbKey]);
                    }

                    // 2. Filter out orphans
                    $data[$cbKey] = array_values(array_intersect($data[$cbKey], $valids['checkboxes']));

                    if ($original !== $data[$cbKey]) {
                        $changed = true;
                    }
                }

                // Handle Tags
                $tagKey = "{$colId}_tags";
                if (isset($data[$tagKey]) && is_array($data[$tagKey])) {
                    $original = $data[$tagKey];

                    // 1. Apply renames
                    if (isset($renameMap[$colId]['tags'])) {
                        $data[$tagKey] = array_map(function ($val) use ($renameMap, $colId) {
                            return $renameMap[$colId]['tags'][$val] ?? $val;
                        }, $data[$tagKey]);
                    }

                    // 2. Filter out orphans
                    $data[$tagKey] = array_values(array_intersect($data[$tagKey], $valids['tags']));

                    if ($original !== $data[$tagKey]) {
                        $changed = true;
                    }
                }
            }

            if ($changed) {
                $content->content = $data;
                $content->save();
            }
        }
    }

    public function index($shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::guard('sanctum')->user();

        $userId = $user ? $user->id : 'guest';
        $version = Cache::get("roster_version_{$faction->id}", 0);
        $cacheKey = "roster_index_{$faction->id}_{$userId}_v{$version}";

        $data = Cache::remember($cacheKey, 3600, function () use ($faction, $user) {
            $isGlobalViewer = User::hasFactionPermission($user, $faction, 'view_faction_roster');
            $hasSandboxPerm = User::hasFactionPermission($user, $faction, 'utilize_sandbox_rosters');

            $rosters = $faction->rosters()
                ->where('is_sandbox', false)
                ->with(['rootSections.children', 'rootSections.contents.editor', 'rosterPermissions'])
                ->orderBy('order')
                ->orderBy('id')
                ->get();

            $filteredRosters = $rosters->filter(function ($roster) use ($user, $isGlobalViewer) {
                $hasExplicitPerms = $roster->rosterPermissions->isNotEmpty();
                if ($hasExplicitPerms) {
                    return User::hasRosterPermission($user, $roster, 'view_roster');
                }

                return $isGlobalViewer || User::hasRosterPermission($user, $roster, 'view_roster');
            });

            $sandboxRosters = collect();
            if ($hasSandboxPerm && $user) {
                $sandboxRosters = $faction->rosters()
                    ->where('is_sandbox', true)
                    ->where('created_by', $user->id)
                    ->with(['rootSections.children', 'rootSections.contents.editor', 'rosterPermissions'])
                    ->orderBy('order')
                    ->orderBy('id')
                    ->get();
            }

            if ($filteredRosters->isEmpty() && ! $isGlobalViewer && ! $hasSandboxPerm) {
                return null;
            }

            $allRosters = $filteredRosters->concat($sandboxRosters);

            // Include Published Record Databases & Entries — all for resolution, filter for response later
            $allPublishedDatabases = $faction->recordDatabases()
                ->where('is_published', true)
                ->with(['entries' => function ($query) {
                    $query->where('is_active', true);
                }, 'databasePermissions'])
                ->get();

            $publishedDatabases = $allPublishedDatabases->filter(fn ($db) => User::hasRecordPermission($user, $db, 'view_database'))->values();

            // Include Datasets for resolution
            $datasets = $faction->rosterDatasets()->with('options')->get();
            $datasetsById = $datasets->keyBy('id');

            // Filter and mask record database entries for view-only users
            $resolutionDbsById = $allPublishedDatabases->keyBy('id');
            $publishedDbsById = $publishedDatabases->keyBy('id');
            $referencedEntriesByDb = [];
            $hiddenFieldsByDb = [];

            foreach ($allPublishedDatabases as $db) {
                $referencedEntriesByDb[$db->id] = [
                    'ids' => [],
                    'values' => [],
                    'fields' => [],
                ];
                $hiddenFieldsByDb[$db->id] = [];
            }

            $getLinkedDatabaseId = function ($col) use ($datasetsById) {
                if (isset($col['linked_database_id']) && $col['linked_database_id']) {
                    return $col['linked_database_id'];
                }
                if (isset($col['dataset_id']) && $col['dataset_id']) {
                    $ds = $datasetsById->get($col['dataset_id']);
                    if ($ds && $ds->record_database_id) {
                        return $ds->record_database_id;
                    }
                }

                return null;
            };

            // Collect all target row IDs referenced in linked roster columns to resolve them in bulk
            $linkRowIds = [];
            $collectLinks = function ($section) use (&$collectLinks, &$linkRowIds) {
                if ($section->contents) {
                    foreach ($section->contents as $content) {
                        $data = $content->content;
                        if (is_array($data)) {
                            foreach ($data as $colId => $val) {
                                if (is_array($val) && isset($val['row_id']) && isset($val['col_id'])) {
                                    $linkRowIds[] = $val['row_id'];
                                }
                            }
                        }
                    }
                }
                if ($section->children) {
                    foreach ($section->children as $child) {
                        $collectLinks($child);
                    }
                }
            };

            foreach ($filteredRosters as $roster) {
                foreach ($roster->rootSections as $section) {
                    $collectLinks($section);
                }
            }
            $linkRowIds = array_unique($linkRowIds);

            $resolvedLinksMap = [];
            if (! empty($linkRowIds)) {
                $contents = RosterContent::whereIn('id', $linkRowIds)
                    ->with(['section.roster.faction', 'section.roster.rosterPermissions'])
                    ->get()
                    ->keyBy('id');

                $datasetCache = [];
                $rosterColsCache = [];

                foreach ($linkRowIds as $rowId) {
                    $content = $contents->get($rowId);
                    if (! $content) {
                        continue;
                    }

                    $roster = $content->section->roster;
                    if (! User::canViewRoster($user, $roster)) {
                        continue;
                    }

                    $rosterId = $roster->id;
                    if (! isset($rosterColsCache[$rosterId])) {
                        $rosterColsCache[$rosterId] = collect($roster->columns ?? []);
                    }

                    foreach ($content->content as $colId => $value) {
                        $col = null;
                        if (! ($content->section->use_roster_columns ?? true)) {
                            $col = collect($content->section->columns ?? [])->firstWhere('id', $colId);
                        }
                        if (! $col) {
                            $col = $rosterColsCache[$rosterId]->firstWhere('id', $colId);
                        }

                        if ($col && str_contains($col['type'] ?? '', 'hidden')) {
                            if (! User::hasRosterPermission($user, $roster, 'view_hidden_data')) {
                                $resolvedLinksMap["{$rowId}_{$colId}"] = '????';

                                continue;
                            }
                        }

                        if ($col && isset($col['dataset_id'])) {
                            $datasetId = $col['dataset_id'];
                            if (! isset($datasetCache[$datasetId])) {
                                $datasetCache[$datasetId] = RosterDataset::find($datasetId);
                            }
                            $dataset = $datasetCache[$datasetId];

                            if ($dataset) {
                                if ($dataset->record_database_id) {
                                    $db = FactionRecordDatabase::find($dataset->record_database_id);
                                    if ($db && is_numeric($value) && filter_var($value, FILTER_VALIDATE_INT) !== false) {
                                        $entry = $db->entries()->where('entry_id', $value)->first();
                                        if ($entry) {
                                            $fieldId = $col['database_field_id'] ?? $db->database_structure[0]['id'] ?? 'id';
                                            if ($fieldId === 'id') {
                                                $value = $entry->entry_id;
                                            } else {
                                                $value = $entry->data[$fieldId] ?? $value;
                                            }
                                        }
                                    }
                                } else {
                                    if (is_numeric($value) && filter_var($value, FILTER_VALIDATE_INT) !== false) {
                                        $option = $dataset->options()->where('id', $value)->first();
                                        if ($option) {
                                            $value = $option->value;
                                        }
                                    }
                                }
                            }
                        }

                        $resolvedLinksMap["{$rowId}_{$colId}"] = (is_array($value) || is_object($value)) ? '-' : (string) $value;
                    }
                }
            }

            $scanSection = function ($section, $roster) use (&$scanSection, &$referencedEntriesByDb, &$hiddenFieldsByDb, $getLinkedDatabaseId, $publishedDbsById, $user, $resolvedLinksMap, $resolutionDbsById) {
                $config = $section->section_options['dynamic_config'] ?? null;
                $isDynamicDb = ($section->data_source === 'dynamic') &&
                    $config &&
                    (($config['source_type'] ?? null) === 'database') &&
                    isset($config['source_id']);
                $dynamicDbId = $isDynamicDb ? $config['source_id'] : null;

                $columns = $section->use_roster_columns ? ($roster->columns ?? []) : ($section->columns ?: ($roster->columns ?? []));
                $canViewHidden = User::hasRosterPermission($user, $roster, 'view_hidden_data');
                $isEditor = User::hasRosterPermission($user, $roster, 'edit_defined_fields') ||
                            User::hasRosterPermission($user, $roster, 'edit_predefined') ||
                            User::hasRosterPermission($user, $roster, 'modify_roster');

                // Map column IDs to their linked database IDs and fields
                $colDbIds = [];
                foreach ($columns as $col) {
                    if (isset($col['id'])) {
                        $dbId = $getLinkedDatabaseId($col);
                        if ($dbId && isset($referencedEntriesByDb[$dbId])) {
                            $colDbIds[$col['id']] = [
                                'db_id' => $dbId,
                                'col' => $col,
                            ];

                            $db = $publishedDbsById->get($dbId);
                            $fieldId = $col['database_field_id'] ?? $db->database_structure[0]['id'] ?? null;
                            if ($fieldId) {
                                $referencedEntriesByDb[$dbId]['fields'][] = $fieldId;

                                // If this column type is hidden and user lacks view_hidden_data, mark the field as hidden
                                if (! $canViewHidden && str_contains($col['type'] ?? '', 'hidden')) {
                                    $hiddenFieldsByDb[$dbId][] = $fieldId;
                                }
                            }
                        }
                    }
                }

                if ($section->contents) {
                    foreach ($section->contents as $content) {
                        if ($dynamicDbId && isset($referencedEntriesByDb[$dynamicDbId])) {
                            $referencedEntriesByDb[$dynamicDbId]['ids'][] = $content->id;
                        }

                        $data = $content->content;
                        if (is_array($data)) {
                            $changed = false;
                            // Resolve database IDs, database_data and linked_roster_data into the content object for non-editors
                            foreach ($columns as $col) {
                                $colId = $col['id'] ?? null;
                                if (! $colId) {
                                    continue;
                                }

                                if (! $isEditor) {
                                    $dbId = $getLinkedDatabaseId($col);
                                    if ($dbId) {
                                        $val = $data[$colId] ?? null;
                                        if ($val && (is_numeric($val) || (is_string($val) && str_starts_with($val, 'temp_')))) {
                                            $db = $resolutionDbsById->get($dbId);
                                            if ($db && $db->relationLoaded('entries')) {
                                                $entry = $db->entries->firstWhere('entry_id', $val);
                                                if ($entry) {
                                                    $fieldId = $col['database_field_id'] ?? $db->database_structure[0]['id'] ?? 'id';
                                                    $data[$colId] = ($fieldId === 'id') ? $entry->entry_id : ($entry->data[$fieldId] ?? $val);
                                                    $changed = true;
                                                }
                                            }
                                        }
                                    }
                                }

                                if (($col['type'] ?? '') === 'linked_roster_data') {
                                    if (! $isEditor) {
                                        $val = $data[$colId] ?? null;
                                        if (is_array($val) && isset($val['row_id']) && isset($val['col_id'])) {
                                            $linkKey = "{$val['row_id']}_{$val['col_id']}";
                                            $data[$colId] = $resolvedLinksMap[$linkKey] ?? '-';
                                            $changed = true;
                                        }
                                    }
                                } elseif (str_contains($col['type'] ?? '', 'database_data') && isset($col['source_column_id'])) {
                                    $sourceColId = $col['source_column_id'];
                                    $sourceCol = collect($columns)->firstWhere('id', $sourceColId);
                                    $sourceValue = $data[$sourceColId] ?? null;

                                    if ($sourceCol && ($sourceCol['type'] ?? '') === 'linked_roster_data' && is_array($sourceValue)) {
                                        $linkKey = "{$sourceValue['row_id']}_{$sourceValue['col_id']}";
                                        $sourceValue = $resolvedLinksMap[$linkKey] ?? null;
                                    }

                                    if ($sourceValue) {
                                        $dbId = $getLinkedDatabaseId($sourceCol);
                                        $db = $dbId ? $resolutionDbsById->get($dbId) : null;

                                        if ($db && $db->relationLoaded('entries')) {
                                            $entry = $db->entries->first(function ($e) use ($sourceCol, $sourceValue, $db) {
                                                $fieldId = $sourceCol['database_field_id'] ?? $db->database_structure[0]['id'] ?? 'id';
                                                $label = ($fieldId === 'id') ? (string) $e->entry_id : $e->data[$fieldId] ?? null;

                                                return $label == $sourceValue;
                                            });

                                            if ($entry) {
                                                $fieldId = $col['data_field_id'] ?? null;
                                                $data[$colId] = ($fieldId === 'id') ? $entry->entry_id : $entry->data[$fieldId] ?? '-';
                                                $changed = true;
                                            }
                                        }
                                    }
                                }
                            }

                            if ($changed) {
                                $content->content = $data;
                            }

                            foreach ($colDbIds as $colId => $colInfo) {
                                $dbId = $colInfo['db_id'];
                                $val = $data[$colId] ?? null;
                                if ($val !== null && $val !== '') {
                                    if (is_array($val) && isset($val['row_id']) && isset($val['col_id'])) {
                                        $linkKey = "{$val['row_id']}_{$val['col_id']}";
                                        $resolvedVal = $resolvedLinksMap[$linkKey] ?? null;
                                        if ($resolvedVal !== null && $resolvedVal !== '') {
                                            $referencedEntriesByDb[$dbId]['values'][] = (string) $resolvedVal;
                                        }
                                    } else {
                                        $referencedEntriesByDb[$dbId]['values'][] = (string) $val;
                                    }
                                }
                            }
                        }
                    }
                }

                if ($section->children) {
                    foreach ($section->children as $child) {
                        $scanSection($child, $roster);
                    }
                }
            };

            foreach ($allRosters as $roster) {
                foreach ($roster->rootSections as $section) {
                    $scanSection($section, $roster);
                }
            }

            $allRosters->each(function ($roster) use ($user) {
                if ($roster->is_sandbox) {
                    $perms = [
                        'view_roster' => true,
                        'modify_roster' => true,
                        'manage_columns' => true,
                        'manage_layout' => true,
                        'add_sections' => true,
                        'remove_sections' => true,
                        'edit_predefined' => true,
                        'edit_defined_fields' => true,
                        'view_hidden_data' => true,
                    ];
                    $roster->user_roster_permissions = $perms;
                } else {
                    $canModify = User::hasRosterPermission($user, $roster, 'modify_roster');
                    $canViewHidden = $canModify || User::hasRosterPermission($user, $roster, 'view_hidden_data');

                    $perms = [
                        'view_roster' => User::hasRosterPermission($user, $roster, 'view_roster'),
                        'modify_roster' => $canModify,
                        'manage_columns' => User::hasRosterPermission($user, $roster, 'manage_columns'),
                        'manage_layout' => User::hasRosterPermission($user, $roster, 'manage_layout'),
                        'add_sections' => User::hasRosterPermission($user, $roster, 'add_sections'),
                        'remove_sections' => User::hasRosterPermission($user, $roster, 'remove_sections'),
                        'edit_predefined' => User::hasRosterPermission($user, $roster, 'edit_predefined'),
                        'edit_defined_fields' => User::hasRosterPermission($user, $roster, 'edit_defined_fields'),
                        'view_hidden_data' => $canViewHidden,
                    ];
                    $roster->user_roster_permissions = $perms;

                    // Apply data masking if user cannot view hidden data
                    if (! $canViewHidden) {
                        $hiddenColIds = collect($roster->columns ?? [])
                            ->filter(fn ($col) => str_contains($col['type'] ?? '', 'hidden'))
                            ->pluck('id')
                            ->toArray();

                        foreach ($roster->rootSections as $section) {
                            $this->maskSection($section, $hiddenColIds, $roster, true);
                        }
                    }
                }
            });

            return $allRosters->values();
        });

        $this->audit('roster.list', "Viewed rosters list for faction {$faction->name}");

        if ($data === null) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($data);
    }

    private function maskSection($section, array $rosterHiddenColIds, $roster = null, $omit = false)
    {
        $hiddenColIds = $rosterHiddenColIds;
        if ($section->columns && ! $section->use_roster_columns) {
            $hiddenColIds = collect($section->columns)
                ->filter(fn ($col) => str_contains($col['type'] ?? '', 'hidden'))
                ->pluck('id')
                ->toArray();
        }

        // Mask contents of this section
        if ($section->contents) {
            foreach ($section->contents as $content) {
                $data = $content->content;
                if (is_array($data)) {
                    foreach ($hiddenColIds as $colId) {
                        if (isset($data[$colId]) && $data[$colId] !== '') {
                            if ($omit) {
                                unset($data[$colId]);
                            } else {
                                $data[$colId] = '????';
                            }
                        }
                    }
                    $content->content = $data;
                }
            }
        }

        // Recursively mask children
        if ($section->children) {
            foreach ($section->children as $child) {
                $this->maskSection($child, $rosterHiddenColIds, $roster, $omit);
            }
        }
    }

    public function store(Request $request, $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $isSandbox = $request->boolean('is_sandbox', false);

        if ($isSandbox) {
            if (! User::hasFactionPermission(Auth::user(), $faction, 'utilize_sandbox_rosters')) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        } else {
            if (! User::hasFactionPermission(Auth::user(), $faction, 'create_roster')) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'shortname' => 'required|string|max:6', // limited to 6 characters, uppercase will be handled or validated
            'color' => ['required', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'roster_options' => 'nullable|array',
            'columns' => 'nullable|array',
            'layout_settings' => 'nullable|array',
            'default_sections_per_row' => 'nullable|integer|min:1|max:4',
            'is_sandbox' => 'sometimes|boolean',
        ]);

        $validated['shortname'] = strtoupper($validated['shortname']);

        // Get next order
        $maxOrder = $faction->rosters()->max('order') ?? -1;

        $defaultColumns = [
            ['id' => 'rank', 'name' => 'Rank', 'type' => 'dropdown', 'options' => [], 'checkboxes' => ['Acting']],
            ['id' => 'name', 'name' => 'Name', 'type' => 'text', 'checkboxes' => ['LOA']],
            ['id' => 'position', 'name' => 'Position', 'type' => 'text', 'checkboxes' => []],
            ['id' => 'callsign', 'name' => 'Callsign', 'type' => 'text', 'checkboxes' => []],
        ];

        $template = $faction->roster_template ?? [];
        $columns = $validated['columns'] ?? $template['columns'] ?? $defaultColumns;
        $layoutSettings = $validated['layout_settings'] ?? $template['layout_settings'] ?? null;
        $defaultSectionsPerRow = $validated['default_sections_per_row'] ?? $template['default_sections_per_row'] ?? 1;
        $rosterOptions = $validated['roster_options'] ?? $template['roster_options'] ?? null;

        $roster = $faction->rosters()->create([
            ...$validated,
            'is_sandbox' => $isSandbox,
            'order' => $maxOrder + 1,
            'columns' => $columns,
            'layout_settings' => $layoutSettings,
            'default_sections_per_row' => $defaultSectionsPerRow,
            'roster_options' => $rosterOptions,
            'created_by' => Auth::id(),
        ]);

        // Automatically create a master section
        $roster->sections()->create([
            'name' => 'Main Section',
            'shortname' => 'MAIN',
            'type' => 'master',
            'order' => 0,
            'created_by' => Auth::id(),
        ]);

        $this->audit('roster.create', "Created roster '{$roster->name}' for faction '{$faction->name}'", null, $roster, null, $roster->getAttributes());

        return response()->json($roster, 201);
    }

    public function update(Request $request, Roster $roster)
    {
        $user = Auth::user();
        if ($roster->is_sandbox) {
            if ($roster->created_by !== $user->id || ! User::hasFactionPermission($user, $roster->faction, 'utilize_sandbox_rosters')) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
            $canModify = true;
            $canManageLayout = true;
            $canManageColumns = true;
        } else {
            $canModify = User::hasRosterPermission($user, $roster, 'modify_roster');
            $canManageLayout = User::hasRosterPermission($user, $roster, 'manage_layout');
            $canManageColumns = User::hasRosterPermission($user, $roster, 'manage_columns');

            if (! $canModify && ! $canManageLayout && ! $canManageColumns) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'shortname' => 'sometimes|string|max:6',
            'color' => ['sometimes', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'roster_options' => 'nullable|array',
            'columns' => 'nullable|array',
            'counts' => 'nullable|array',
            'layout_settings' => 'nullable|array',
            'default_sections_per_row' => 'nullable|integer|min:1|max:4',
            'section_order' => 'nullable|array',
            'created_by' => 'nullable|integer|exists:users,id',
        ]);

        // Authorization logic for specific fields
        $toUpdate = [];

        // Critical settings (name, color, shortname) -> modify_roster
        if ($canModify) {
            foreach (['name', 'shortname', 'color', 'roster_options', 'counts', 'created_by'] as $field) {
                if (isset($validated[$field]) || array_key_exists($field, $validated)) {
                    $toUpdate[$field] = $validated[$field];
                }
            }
        }

        // Layout settings -> manage_layout
        if ($canManageLayout) {
            foreach (['layout_settings', 'default_sections_per_row', 'section_order'] as $field) {
                if (isset($validated[$field])) {
                    $toUpdate[$field] = $validated[$field];
                }
            }
        }

        // Columns -> manage_columns
        if ($canManageColumns) {
            if (isset($validated['columns'])) {
                $toUpdate['columns'] = $validated['columns'];
                $this->cleanUpOrphanedData($roster, $validated['columns']);
            }
        }

        if (empty($toUpdate) && ! isset($validated['section_order'])) {
            return response()->json(['message' => 'No authorized changes provided'], 403);
        }

        $oldValues = $roster->getOriginal();
        $roster->update(collect($toUpdate)->except('section_order')->toArray());

        if (isset($validated['section_order']) && $canManageLayout) {
            foreach ($validated['section_order'] as $index => $id) {
                $roster->sections()->where('id', $id)->update(['order' => $index]);
            }
        }

        $this->audit('roster.update', "Updated roster '{$roster->name}' for faction '{$roster->faction->name}'", null, $roster, $oldValues, $roster->getDirty());

        RosterRevision::logRevision($roster->id, 'Updated roster settings', Auth::id());

        return response()->json($roster);
    }

    public function destroy(Roster $roster)
    {
        $user = Auth::user();
        if ($roster->is_sandbox) {
            if ($roster->created_by !== $user->id || ! User::hasFactionPermission($user, $roster->faction, 'utilize_sandbox_rosters')) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        } else {
            if (! User::hasRosterPermission($user, $roster, 'modify_roster')) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        $this->audit('roster.delete', "Deleted roster '{$roster->name}' for faction '{$roster->faction->name}'", null, $roster, $roster->getAttributes());

        $roster->delete();

        return response()->json(['message' => 'Roster deleted']);
    }

    public function resolveLinks(Request $request)
    {
        $user = Auth::guard('sanctum')->user();
        $links = $request->input('links', []);
        $results = [];

        // Group by row_id to minimize queries
        $rowIds = collect($links)->pluck('row_id')->filter()->unique();
        $contents = RosterContent::whereIn('id', $rowIds)->with('section.roster.faction')->get()->keyBy('id');

        // Cache for rosters and datasets to avoid repeated lookups
        $rosterCache = [];
        $datasetCache = [];

        foreach ($links as $link) {
            $rosterId = $link['roster_id'] ?? null;
            $rowId = $link['row_id'] ?? null;
            $colId = $link['col_id'] ?? null;

            if (! $rosterId || ! $rowId || ! $colId) {
                $results[] = '-';

                continue;
            }

            $content = $contents->get($rowId);
            if (! $content || $content->section->roster_id != $rosterId) {
                $results[] = '-';

                continue;
            }

            // Check if user can view this roster
            if (! User::canViewRoster($user, $content->section->roster)) {
                $results[] = '-';

                continue;
            }

            $value = $content->content[$colId] ?? '-';

            // Resolve label if it's a dataset/predefined type
            if (! isset($rosterCache[$rosterId])) {
                $rosterCache[$rosterId] = $content->section->roster;
            }
            $roster = $rosterCache[$rosterId];

            $col = null;
            if (! ($content->section->use_roster_columns ?? true)) {
                $col = collect($content->section->columns ?? [])->firstWhere('id', $colId);
            }
            if (! $col) {
                $col = collect($roster->columns ?? [])->firstWhere('id', $colId);
            }

            // Mask if it's a hidden column and user doesn't have permission
            if ($col && str_contains($col['type'] ?? '', 'hidden')) {
                if (! User::hasRosterPermission($user, $roster, 'view_hidden_data')) {
                    $results[] = '????';

                    continue;
                }
            }

            if ($col && isset($col['dataset_id'])) {
                $datasetId = $col['dataset_id'];
                if (! isset($datasetCache[$datasetId])) {
                    $datasetCache[$datasetId] = RosterDataset::find($datasetId);
                }
                $dataset = $datasetCache[$datasetId];

                if ($dataset) {
                    if ($dataset->record_database_id) {
                        $db = FactionRecordDatabase::find($dataset->record_database_id);
                        if ($db && is_numeric($value) && filter_var($value, FILTER_VALIDATE_INT) !== false) {
                            $entry = $db->entries()->where('entry_id', $value)->first();
                            if ($entry) {
                                $fieldId = $col['database_field_id'] ?? $db->database_structure[0]['id'] ?? 'id';
                                if ($fieldId === 'id') {
                                    $value = $entry->entry_id;
                                } else {
                                    $value = $entry->data[$fieldId] ?? $value;
                                }
                            }
                        }
                    } else {
                        if (is_numeric($value) && filter_var($value, FILTER_VALIDATE_INT) !== false) {
                            $option = $dataset->options()->where('id', $value)->first();
                            if ($option) {
                                $value = $option->value;
                            }
                        }
                    }
                }
            }

            $results[] = (string) $value;
        }

        $this->audit('roster.resolve_links', 'Resolved links for roster rows');

        return response()->json(['results' => $results]);
    }

    public function reorder(Request $request, $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();

        $request->validate([
            'roster_ids' => 'required|array',
            'roster_ids.*' => 'exists:rosters,id',
        ]);

        $rosters = Roster::whereIn('id', $request->roster_ids)->get();
        $allSandbox = $rosters->isNotEmpty() && $rosters->every(fn ($r) => $r->is_sandbox && $r->created_by === Auth::id());

        if ($allSandbox) {
            if (! User::hasFactionPermission(Auth::user(), $faction, 'utilize_sandbox_rosters')) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        } else {
            if (! User::hasFactionPermission(Auth::user(), $faction, 'global_roster_moderation')) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        foreach ($request->roster_ids as $index => $id) {
            Roster::where('id', $id)->where('faction_id', $faction->id)->update(['order' => $index]);
        }

        if (! $allSandbox) {
            $this->audit('roster.reorder', "Reordered rosters for faction {$faction->name}", null, null, null, $request->roster_ids);
        }

        return response()->json(['message' => 'Order updated']);
    }
}
