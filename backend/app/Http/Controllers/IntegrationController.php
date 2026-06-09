<?php

namespace App\Http\Controllers;

use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Models\FactionRecordEntry;
use App\Models\RosterContent;
use App\Models\RosterSection;
use App\Models\User;
use App\Services\GtawService;
use App\Services\RosterFlagService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class IntegrationController extends Controller
{
    protected GtawService $gtawService;

    public function __construct(GtawService $gtawService)
    {
        $this->gtawService = $gtawService;
    }

    public function getAvailableFactions(string $shortname)
    {
        $user = Auth::user();
        if (! $user->gtaw_access_token) {
            return response()->json(['message' => 'User not linked with GTA:W'], 400);
        }

        $res = $this->gtawService->getFactions($user->gtaw_access_token);
        if (! $res || ! isset($res['data'])) {
            return response()->json(['message' => 'Failed to fetch factions from GTA:W or invalid response'], 500);
        }

        $factions = $res['data'];
        $available = [];

        foreach ($factions as $f) {
            $rank = $f['faction_rank'] ?? 0;
            if ($rank >= 15) {
                $available[] = [
                    'id' => $f['faction'],
                    'name' => $f['faction_name'],
                    'rank' => $rank,
                    'rank_name' => $f['faction_rank_name'] ?? '',
                ];
            }
        }

        $faction = Faction::where('shortname', $shortname)->first();
        $this->audit('integration.gtaw.available_factions', 'Fetched available GTA:W factions for integration'.($faction ? " on faction '{$faction->name}'" : ''), null, $faction);

        return response()->json($available);
    }

    public function setupGtaw(Request $request, string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();

        if (! Auth::user()->hasPermission('sync_gtaw', $faction->id)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'gtaw_faction_id' => 'required|integer',
        ]);

        if ($faction->gtaw_faction_id) {
            return response()->json(['message' => 'Integration already exists'], 400);
        }

        $oldValues = $faction->getOriginal();

        return DB::transaction(function () use ($request, $faction, $oldValues) {
            $faction->update([
                'gtaw_faction_id' => $request->gtaw_faction_id,
            ]);

            $dbs = $this->ensureGtawDatabases($faction);

            $this->audit('integration.gtaw.setup', "Set up GTA:W integration for faction '{$faction->name}' with GTA:W faction ID {$request->gtaw_faction_id}", null, $faction, $oldValues, $faction->getDirty());

            return response()->json([
                'message' => 'Integration setup successful',
                'databases' => [
                    'characters' => $dbs['CHARS'],
                    'history' => $dbs['CHIST'],
                    'name_changes' => $dbs['CNAME'],
                    'activity' => $dbs['ACTIVITY'],
                ],
            ]);
        });
    }

    public function syncGtaw(Request $request, string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();

        if (! Auth::user()->hasPermission('sync_gtaw', $faction->id)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! $faction->gtaw_faction_id) {
            return response()->json(['message' => 'Integration not setup'], 400);
        }

        $user = Auth::user();
        if (! $user->gtaw_access_token) {
            return response()->json(['message' => 'User not linked with GTA:W'], 400);
        }

        $res = $this->gtawService->getFactionMembers($user->gtaw_access_token, $faction->gtaw_faction_id);
        if (! $res || ! isset($res['data']['members'])) {
            return response()->json(['message' => 'Failed to fetch members from GTA:W or invalid response'], 500);
        }

        // Optional: Fetch ABAS data if available
        $abasRes = $this->gtawService->getFactionAbas($user->gtaw_access_token, $faction->gtaw_faction_id);
        $abasData = collect(($abasRes && isset($abasRes['data'])) ? $abasRes['data'] : [])
            ->keyBy('character_id')
            ->toArray();

        $dbs = $this->ensureGtawDatabases($faction);
        $charDb = $dbs['CHARS'];
        $historyDb = $dbs['CHIST'];
        $nameChangeDb = $dbs['CNAME'];
        $activityDb = $dbs['ACTIVITY'];

        $currentEntries = $charDb->entries()->get();

        // 1. Deduplicate GTA:W members list first
        $gtawMembers = collect($res['data']['members'] ?? [])
            ->groupBy('character_id')
            ->map(fn ($group) => $group->sortByDesc('rank')->first())
            ->values()
            ->toArray();

        $now = now()->toDateString();
        $syncResults = [
            'added' => 0,
            'updated' => 0,
            'removed' => 0,
            'duplicates_removed' => 0,
            'name_changes' => 0,
            'activity_logs' => 0,
        ];

        DB::transaction(function () use ($faction, $charDb, $historyDb, $nameChangeDb, $activityDb, $gtawMembers, $abasData, $now, &$syncResults) {
            // 2. Pre-sync duplicate cleanup for Characters Database (before any other logic)
            $charDb->entries()->get()
                ->groupBy(fn ($e) => $e->data['char_id'] ?? null)
                ->filter(fn ($g, $id) => $id && $g->count() > 1)
                ->each(function ($group) use (&$syncResults) {
                    $keepId = $group->max('id');
                    foreach ($group as $entry) {
                        if ($entry->id !== $keepId) {
                            $entry->delete();
                            $syncResults['duplicates_removed']++;
                        }
                    }
                });

            // Refresh current entries after cleanup
            $freshEntries = $charDb->entries()->get();
            $processedCharIds = [];

            // 3. Pre-calculate is_alt markers based on highest rank
            $userGroups = collect($gtawMembers)->groupBy('user_id');
            $isAltMap = [];
            foreach ($userGroups as $userId => $group) {
                if ($group->count() <= 1) {
                    $isAltMap[$group->first()['character_id']] = false;

                    continue;
                }

                $highestRank = $group->max('rank');
                $primaryChar = $group->where('rank', $highestRank)->sortByDesc('character_id')->first();

                foreach ($group as $m) {
                    $isAltMap[$m['character_id']] = ($m['character_id'] !== $primaryChar['character_id']);
                }
            }

            // Pre-calculate Total ABAS for each user
            $userAbasTotals = [];
            foreach ($gtawMembers as $member) {
                $charId = $member['character_id'];
                $abas = $abasData[$charId]['abas'] ?? $member['abas'] ?? 0;
                $userId = $member['user_id'];
                $userAbasTotals[$userId] = ($userAbasTotals[$userId] ?? 0) + (float) $abas;
            }

            foreach ($gtawMembers as $member) {
                $charId = $member['character_id'];
                $processedCharIds[] = $charId;

                $existingEntry = $freshEntries->first(function ($e) use ($charId) {
                    return ($e->data['char_id'] ?? null) == $charId;
                });

                $abasValue = $abasData[$charId]['abas'] ?? $member['abas'] ?? 0;
                $abasString = number_format((float) $abasValue, 2);

                $memberData = [
                    'id' => $member['character_id'],
                    'name' => $member['character_name'],
                    'rank' => $member['rank_name'],
                    'rank_id' => $member['rank'] ?? 0,
                    'abas' => $abasString,
                    'total_abas' => number_format($userAbasTotals[$member['user_id']] ?? 0, 2),
                    'user_id' => $member['user_id'],
                    'char_id' => $member['character_id'],
                    'is_alt' => $isAltMap[$charId] ?? false,
                ];

                // Check for ABAS change
                $oldAbas = $existingEntry ? (float) ($existingEntry->data['abas'] ?? 0) : 0;
                $newAbas = (float) $abasValue;

                if (abs($oldAbas - $newAbas) > 0.001) {
                    $activityDb->entries()->create([
                        'entry_id' => ($activityDb->entries()->withTrashed()->max('entry_id') ?? 0) + 1,
                        'data' => [
                            'char_id' => $charId,
                            'user_id' => $member['user_id'],
                            'name' => $member['character_name'],
                            'abas' => number_format($oldAbas, 2).' > '.$abasString,
                            'date' => $now,
                        ],
                        'created_by' => null,
                    ]);
                    $syncResults['activity_logs']++;
                }

                if ($existingEntry) {
                    // Check for name change
                    if ($existingEntry->data['name'] !== $member['character_name']) {
                        $nameChangeDb->entries()->create([
                            'entry_id' => ($nameChangeDb->entries()->withTrashed()->max('entry_id') ?? 0) + 1,
                            'data' => [
                                'char_id' => $charId,
                                'old_name' => $existingEntry->data['name'],
                                'new_name' => $member['character_name'],
                                'date' => $now,
                            ],
                            'created_by' => null,
                        ]);
                        $syncResults['name_changes']++;
                    }

                    // Only update if data has actually changed (avoids unnecessary audit log entries)
                    $existingData = $existingEntry->data;
                    $hasChanges = false;
                    foreach ($memberData as $key => $value) {
                        if (! array_key_exists($key, $existingData) || $existingData[$key] != $value) {
                            $hasChanges = true;
                            break;
                        }
                    }

                    if ($hasChanges) {
                        $existingEntry->update(['data' => $memberData]);
                        $syncResults['updated']++;
                    }
                } else {
                    // Create new
                    $charDb->entries()->create([
                        'entry_id' => ($charDb->entries()->withTrashed()->max('entry_id') ?? 0) + 1,
                        'data' => $memberData,
                        'created_by' => null,
                    ]);

                    // Log to history
                    $historyDb->entries()->create([
                        'entry_id' => ($historyDb->entries()->withTrashed()->max('entry_id') ?? 0) + 1,
                        'data' => [
                            'char_id' => $charId,
                            'name' => $member['character_name'],
                            'action' => 'Added',
                            'date' => $now,
                        ],
                        'created_by' => null,
                    ]);

                    $syncResults['added']++;
                }
            }

            // Remove characters no longer in faction
            foreach ($freshEntries as $entry) {
                $charId = $entry->data['char_id'] ?? null;
                if ($charId && ! in_array($charId, $processedCharIds)) {
                    // Log to history before deleting
                    $historyDb->entries()->create([
                        'entry_id' => ($historyDb->entries()->withTrashed()->max('entry_id') ?? 0) + 1,
                        'data' => [
                            'char_id' => $charId,
                            'name' => $entry->data['name'],
                            'action' => 'Removed',
                            'date' => $now,
                        ],
                        'created_by' => null,
                    ]);

                    $entry->delete();
                    $syncResults['removed']++;
                }
            }

            // Final check: Recalculate is_alt markers for all entries based on stored rank_id
            $finalEntries = $charDb->entries()->get();
            $userGroups = $finalEntries->groupBy(fn ($e) => $e->data['user_id'] ?? null);

            foreach ($userGroups as $userId => $group) {
                if ($group->count() <= 1) {
                    $entry = $group->first();
                    if (($entry->data['is_alt'] ?? null) !== false) {
                        $newData = $entry->data;
                        $newData['is_alt'] = false;
                        $entry->update(['data' => $newData]);
                    }

                    continue;
                }

                $highestRank = $group->max(fn ($e) => (int) ($e->data['rank_id'] ?? 0));
                $primaryChar = $group->where(fn ($e) => (int) ($e->data['rank_id'] ?? 0) === $highestRank)
                    ->sortByDesc(fn ($e) => (int) ($e->data['char_id'] ?? 0))
                    ->first();

                foreach ($group as $entry) {
                    $isAlt = (($entry->data['char_id'] ?? null) !== ($primaryChar->data['char_id'] ?? null));
                    if (($entry->data['is_alt'] ?? null) !== $isAlt) {
                        $newData = $entry->data;
                        $newData['is_alt'] = $isAlt;
                        $entry->update(['data' => $newData]);
                    }
                }
            }

            // Update linked roster columns and re-evaluate auto-apply rules
            $this->updateLinkedRosterColumns($faction, $charDb);
        });

        // After the transaction: recalculate all flags for this faction
        $flagService = app(RosterFlagService::class);
        foreach ($faction->rosterFlags()->get() as $flag) {
            try {
                $flagService->recalculate($flag);
            } catch (\Throwable $e) {
                \Log::warning("Flag recalculate failed for flag {$flag->id} ({$flag->name}): ".$e->getMessage());
            }
        }

        $this->audit('integration.gtaw.sync', "Synchronized GTA:W members for faction '{$faction->name}'", null, $faction, null, $syncResults);

        return response()->json([
            'message' => 'Synchronization complete',
            'results' => $syncResults,
        ]);
    }

    private function ensureGtawDatabases(Faction $faction)
    {
        $databases = [
            'CHARS' => [
                'name' => 'Characters Database',
                'description' => 'Automated synchronization of faction characters from GTA:W.',
                'record_shortcode' => 'CHARS',
                'structure' => [
                    ['id' => 'id', 'name' => 'ID', 'type' => 'number', 'required' => true],
                    ['id' => 'name', 'name' => 'Character Name', 'type' => 'text', 'required' => true],
                    ['id' => 'rank', 'name' => 'Rank', 'type' => 'text', 'required' => true],
                    ['id' => 'abas', 'name' => 'ABAS', 'type' => 'text', 'required' => false],
                    ['id' => 'total_abas', 'name' => 'Total ABAS', 'type' => 'text', 'required' => false],
                    ['id' => 'user_id', 'name' => 'User ID', 'type' => 'number', 'required' => true],
                    ['id' => 'char_id', 'name' => 'Character ID', 'type' => 'number', 'required' => true],
                    ['id' => 'is_alt', 'name' => 'Alternative Character', 'type' => 'boolean', 'required' => true],
                ],
                'is_published' => true,
                'detail_customization' => [
                    'linked_databases' => [],
                    'roster_integration' => ['enabled' => true],
                    'showcase_field' => 'name',
                ],
            ],
            'ACTIVITY' => [
                'name' => 'Activity Database',
                'description' => 'Logs of ABAS changes for faction members.',
                'record_shortcode' => 'ACTIVITY',
                'structure' => [
                    ['id' => 'char_id', 'name' => 'Character ID', 'type' => 'number', 'required' => true],
                    ['id' => 'user_id', 'name' => 'User ID', 'type' => 'number', 'required' => true],
                    ['id' => 'name', 'name' => 'Character Name', 'type' => 'text', 'required' => true],
                    ['id' => 'abas', 'name' => 'ABAS', 'type' => 'text', 'required' => true],
                    ['id' => 'date', 'name' => 'Date', 'type' => 'date', 'required' => true],
                ],
                'is_published' => true,
            ],
            'CHIST' => [
                'name' => 'Character History',
                'description' => 'Logs of characters joining or leaving the faction on GTA:W.',
                'record_shortcode' => 'CHIST',
                'structure' => [
                    ['id' => 'char_id', 'name' => 'Character ID', 'type' => 'number', 'required' => true],
                    ['id' => 'name', 'name' => 'Character Name', 'type' => 'text', 'required' => true],
                    ['id' => 'action', 'name' => 'Action', 'type' => 'text', 'required' => true],
                    ['id' => 'date', 'name' => 'Date', 'type' => 'date', 'required' => true],
                ],
                'is_published' => true,
            ],
            'CNAME' => [
                'name' => 'Name Changes',
                'description' => 'Logs of character name changes on GTA:W.',
                'record_shortcode' => 'CNAME',
                'structure' => [
                    ['id' => 'char_id', 'name' => 'Character ID', 'type' => 'number', 'required' => true],
                    ['id' => 'old_name', 'name' => 'Old Name', 'type' => 'text', 'required' => true],
                    ['id' => 'new_name', 'name' => 'New Name', 'type' => 'text', 'required' => true],
                    ['id' => 'date', 'name' => 'Date', 'type' => 'date', 'required' => true],
                ],
                'is_published' => true,
            ],
        ];

        $apiTypeMap = [
            'CHARS' => 'gtaw_characters',
            'ACTIVITY' => 'gtaw_activity',
            'CHIST' => 'gtaw_history',
            'CNAME' => 'gtaw_name_changes',
        ];

        $result = [];

        foreach ($databases as $shortcode => $config) {
            $db = $this->findGtawDatabase($faction, $shortcode);
            if (! $db) {
                $db = $faction->recordDatabases()->create([
                    'name' => $config['name'],
                    'description' => $config['description'],
                    'record_shortcode' => $shortcode,
                    'is_api_database' => $apiTypeMap[$shortcode],
                    'is_published' => $config['is_published'] ?? false,
                    'created_by' => null,
                    'database_structure' => $config['structure'],
                    'detail_customization' => $config['detail_customization'] ?? null,
                    'allow_details_view' => true,
                    'data_overview_display' => 'table',
                    'data_entry_display' => 'card',
                ]);

                if ($shortcode === 'CHARS') {
                    // Add self-link for "Other characters of this user"
                    $db->update([
                        'detail_customization' => [
                            'linked_databases' => [
                                [
                                    'id' => (string) Str::uuid(),
                                    'database_id' => $db->id,
                                    'source_field' => 'user_id',
                                    'target_field' => 'user_id',
                                    'exclude_current' => true,
                                ],
                            ],
                            'roster_integration' => ['enabled' => true],
                            'showcase_field' => 'name',
                        ],
                    ]);
                }
            } else {
                // Check and add missing columns
                $currentStructure = $db->database_structure;
                $updated = false;
                foreach ($config['structure'] as $field) {
                    $exists = collect($currentStructure)->contains('id', $field['id']);
                    if (! $exists) {
                        $currentStructure[] = $field;
                        $updated = true;
                    }
                }
                if ($updated) {
                    $db->update(['database_structure' => $currentStructure]);
                }
            }
            $result[$shortcode] = $db;
        }

        return $result;
    }

    public function pruneGtaw(Request $request, string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();

        if (! Auth::user()->hasPermission('sync_gtaw', $faction->id)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $charDb = $this->findGtawDatabase($faction, 'CHARS');
        if ($charDb) {
            $charDb->entries()->delete();
        }

        $this->audit('integration.gtaw.prune', "Pruned synchronized GTA:W database entries for faction '{$faction->name}'", null, $faction);

        return response()->json(['message' => 'All synchronized data pruned']);
    }

    private function updateLinkedRosterColumns(Faction $faction, FactionRecordDatabase $charDb)
    {
        // 1. Get all active entries for character database
        $activeEntries = $charDb->entries()->where('is_active', true)->get();

        // Load datasets by ID to check database links
        $datasetsById = $faction->rosterDatasets()->get()->keyBy('id');

        // 2. Load all rosters and sections for this faction
        $rosters = $faction->rosters()->get();
        $sections = RosterSection::whereIn('roster_id', $rosters->pluck('id'))->get();

        // 3. Load all roster contents for these sections
        $contents = RosterContent::whereIn('section_id', $sections->pluck('id'))->get();
        $contentsById = $contents->keyBy('id');

        $sectionsById = $sections->keyBy('id');
        $rostersById = $rosters->keyBy('id');

        foreach ($contents as $content) {
            $section = $sectionsById->get($content->section_id);
            if (! $section) {
                continue;
            }
            $roster = $rostersById->get($section->roster_id);
            if (! $roster) {
                continue;
            }

            // Determine active columns for this section/content
            $columns = ($section->use_roster_columns ?? true) ? ($roster->columns ?? []) : ($section->columns ?: ($roster->columns ?? []));
            if (! is_array($columns)) {
                continue;
            }

            $data = $content->content;
            if (! is_array($data)) {
                continue;
            }

            $changed = false;

            foreach ($columns as $col) {
                $colId = $col['id'] ?? null;
                if (! $colId) {
                    continue;
                }

                // Check if column is linked to the CHARS database
                $isLinkedToCharDb = false;
                if (isset($col['linked_database_id']) && $col['linked_database_id'] == $charDb->id) {
                    $isLinkedToCharDb = true;
                } elseif (isset($col['dataset_id']) && $col['dataset_id']) {
                    $ds = $datasetsById->get($col['dataset_id']);
                    if ($ds && $ds->record_database_id == $charDb->id) {
                        $isLinkedToCharDb = true;
                    }
                }

                if (! $isLinkedToCharDb) {
                    continue;
                }

                // Stored value in the content
                $val = $data[$colId] ?? null;
                if ($val === null || $val === '') {
                    continue;
                }

                // If it is a linked roster data link, resolve it to its actual value
                if (is_array($val) && isset($val['row_id']) && isset($val['col_id'])) {
                    $linkedContent = $contentsById->get($val['row_id']);
                    $val = ($linkedContent && is_array($linkedContent->content)) ? ($linkedContent->content[$val['col_id']] ?? null) : null;
                }

                if ($val === null || $val === '' || is_array($val)) {
                    continue;
                }

                // 4. Find matching entry in CHARS database
                $matchingEntry = null;

                if (is_numeric($val) && filter_var($val, FILTER_VALIDATE_INT) !== false) {
                    // Try to find the active entry by entry_id
                    $matchingEntry = $activeEntries->firstWhere('entry_id', $val);

                    // If not found in active, it might be soft-deleted or missing
                    if (! $matchingEntry) {
                        // Look up the soft-deleted entry to get the identity (name/char_id)
                        $deletedEntry = $charDb->entries()->onlyTrashed()->where('entry_id', $val)->first();
                        if ($deletedEntry) {
                            $charId = $deletedEntry->data['char_id'] ?? null;
                            $charName = $deletedEntry->data['name'] ?? null;

                            // Check if a new active entry now exists for this character
                            if ($charId) {
                                $matchingEntry = $activeEntries->first(function ($e) use ($charId) {
                                    return ($e->data['char_id'] ?? null) == $charId;
                                });
                            }
                            if (! $matchingEntry && $charName) {
                                $matchingEntry = $activeEntries->first(function ($e) use ($charName) {
                                    return strcasecmp(trim($e->data['name'] ?? ''), trim($charName)) === 0;
                                });
                            }

                            // If we found a new active entry, update the stored value to the new active entry_id!
                            if ($matchingEntry) {
                                $data[$colId] = $matchingEntry->entry_id;
                                $changed = true;
                            }
                        }
                    }

                    // If still not found, search all databases of this faction for this entry_id
                    // (e.g. if it was linked to the old database before it got split/recreated)
                    if (! $matchingEntry) {
                        $anyEntry = FactionRecordEntry::whereIn('database_id', $faction->recordDatabases()->pluck('id'))
                            ->where('entry_id', $val)
                            ->first();
                        if ($anyEntry) {
                            $charName = $anyEntry->data['name'] ?? $anyEntry->data['Character Name'] ?? null;
                            if ($charName) {
                                // Try to find matching active entry in the current characters database by name
                                $matchingEntry = $activeEntries->first(function ($e) use ($charName) {
                                    return strcasecmp(trim($e->data['name'] ?? ''), trim($charName)) === 0;
                                });

                                if ($matchingEntry) {
                                    $data[$colId] = $matchingEntry->entry_id;
                                    $changed = true;
                                    \Log::info("GTA:W Sync auto-healed roster entry ID {$val} to active entry ID {$matchingEntry->entry_id} via character name '{$charName}'");
                                }
                            }
                        }
                    }
                } else {
                    // It is a string (e.g. "John Doe"). Try to find an active entry with matching name
                    $matchingEntry = $activeEntries->first(function ($e) use ($val) {
                        return strcasecmp(trim($e->data['name'] ?? ''), trim($val)) === 0;
                    });

                    if ($matchingEntry) {
                        $data[$colId] = $matchingEntry->entry_id;
                        $changed = true;
                    }
                }

                // 5. Re-evaluate auto-apply checkboxes and tags

                // Process Checkboxes
                if (isset($col['checkboxes']) && is_array($col['checkboxes'])) {
                    $cbKey = "{$colId}_cb";
                    $currentCbs = $data[$cbKey] ?? [];
                    if (! is_array($currentCbs)) {
                        $currentCbs = [];
                    }
                    $originalCbs = $currentCbs;

                    foreach ($col['checkboxes'] as $cb) {
                        if (! is_array($cb)) {
                            continue;
                        }

                        $label = $cb['label'] ?? null;
                        if (! $label) {
                            continue;
                        }

                        $hasAutoApply = isset($cb['auto_apply']) || isset($cb['auto_apply_field']);
                        if (! $hasAutoApply) {
                            continue;
                        }

                        $db_column = $cb['auto_apply_field'] ?? ($cb['auto_apply']['db_column'] ?? null);
                        $match_value = $cb['auto_apply_value'] ?? ($cb['auto_apply']['match_value'] ?? null);

                        if ($matchingEntry && $db_column) {
                            // Evaluate match
                            $dbVal = ($db_column === 'id') ? (string) $matchingEntry->entry_id : ($matchingEntry->data[$db_column] ?? '');

                            if ($match_value !== null && $match_value !== '') {
                                $isMatch = ($dbVal !== null && $dbVal !== '') && (stripos((string) $dbVal, (string) $match_value) !== false);
                            } else {
                                $isMatch = ($dbVal !== null && $dbVal !== '' && $dbVal !== false);
                            }

                            $hasLabel = in_array($label, $currentCbs);
                            if ($isMatch && ! $hasLabel) {
                                $currentCbs[] = $label;
                            } elseif (! $isMatch && $hasLabel) {
                                $currentCbs = array_values(array_diff($currentCbs, [$label]));
                            }
                        } else {
                            // No matching active entry - remove auto-applied checkbox
                            if (in_array($label, $currentCbs)) {
                                $currentCbs = array_values(array_diff($currentCbs, [$label]));
                            }
                        }
                    }

                    if ($currentCbs !== $originalCbs) {
                        $data[$cbKey] = $currentCbs;
                        $changed = true;
                    }
                }

                // Process Tags
                if (isset($col['tags']) && is_array($col['tags'])) {
                    $tagKey = "{$colId}_tags";
                    $currentTags = $data[$tagKey] ?? [];
                    if (! is_array($currentTags)) {
                        $currentTags = [];
                    }
                    $originalTags = $currentTags;

                    foreach ($col['tags'] as $tag) {
                        if (! is_array($tag)) {
                            continue;
                        }

                        $label = $tag['label'] ?? null;
                        if (! $label) {
                            continue;
                        }

                        $hasAutoApply = isset($tag['auto_apply']) || isset($tag['auto_apply_field']);
                        if (! $hasAutoApply) {
                            continue;
                        }

                        $db_column = $tag['auto_apply_field'] ?? ($tag['auto_apply']['db_column'] ?? null);
                        $match_value = $tag['auto_apply_value'] ?? ($tag['auto_apply']['match_value'] ?? null);

                        if ($matchingEntry && $db_column) {
                            // Evaluate match
                            $dbVal = ($db_column === 'id') ? (string) $matchingEntry->entry_id : ($matchingEntry->data[$db_column] ?? '');

                            if ($match_value !== null && $match_value !== '') {
                                $isMatch = ($dbVal !== null && $dbVal !== '') && (stripos((string) $dbVal, (string) $match_value) !== false);
                            } else {
                                $isMatch = ($dbVal !== null && $dbVal !== '' && $dbVal !== false);
                            }

                            $hasLabel = in_array($label, $currentTags);
                            if ($isMatch && ! $hasLabel) {
                                $currentTags[] = $label;
                            } elseif (! $isMatch && $hasLabel) {
                                $currentTags = array_values(array_diff($currentTags, [$label]));
                            }
                        } else {
                            // No matching active entry - remove auto-applied tag
                            if (in_array($label, $currentTags)) {
                                $currentTags = array_values(array_diff($currentTags, [$label]));
                            }
                        }
                    }

                    if ($currentTags !== $originalTags) {
                        $data[$tagKey] = $currentTags;
                        $changed = true;
                    }
                }
            }

            if ($changed) {
                $content->update(['content' => $data]);
            }
        }
    }

    private function findGtawDatabase(Faction $faction, string $shortcode)
    {
        $apiTypeMap = [
            'CHARS' => 'gtaw_characters',
            'ACTIVITY' => 'gtaw_activity',
            'CHIST' => 'gtaw_history',
            'CNAME' => 'gtaw_name_changes',
        ];
        $targetType = $apiTypeMap[$shortcode] ?? null;

        // 1. Try to find by unique api type string in is_api_database
        if ($targetType) {
            $db = $faction->recordDatabases()
                ->where('is_api_database', $targetType)
                ->first();
            if ($db) {
                return $db;
            }
        }

        // 2. Try to find by shortcode (backward compatibility / legacy)
        $db = $faction->recordDatabases()->where('record_shortcode', $shortcode)->first();
        if ($db) {
            // Future proof it: update its is_api_database to the unique string!
            if ($targetType && $db->getRawOriginal('is_api_database') !== $targetType) {
                $db->update(['is_api_database' => $targetType]);
            }

            return $db;
        }

        // 3. Fallback: Find by structure heuristics (for when user renamed the prefix first time)
        $apiDatabases = $faction->recordDatabases()->where('is_api_database', '!=', '0')->get();

        foreach ($apiDatabases as $d) {
            $struct = $d->database_structure;
            if (! is_array($struct)) {
                $struct = json_decode($d->getRawOriginal('database_structure'), true) ?: [];
            }
            $fieldIds = collect($struct)->pluck('id')->toArray();

            $matched = false;
            if ($shortcode === 'CHARS' && in_array('is_alt', $fieldIds)) {
                $matched = true;
            } elseif ($shortcode === 'ACTIVITY' && in_array('abas', $fieldIds) && ! in_array('is_alt', $fieldIds)) {
                $matched = true;
            } elseif ($shortcode === 'CHIST' && in_array('action', $fieldIds)) {
                $matched = true;
            } elseif ($shortcode === 'CNAME' && (in_array('old_name', $fieldIds) || in_array('new_name', $fieldIds))) {
                $matched = true;
            }

            if ($matched) {
                // Future proof it: update its is_api_database to the unique string!
                if ($targetType && $d->getRawOriginal('is_api_database') !== $targetType) {
                    $d->update(['is_api_database' => $targetType]);
                }

                return $d;
            }
        }

        return null;
    }
}
