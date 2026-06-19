<?php

namespace App\Http\Controllers;

use App\Models\FactionRecordDatabase;
use App\Models\FactionRecordEntry;
use App\Models\Roster;
use App\Models\RosterContent;
use App\Models\RosterDataset;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class FactionRecordEntryController extends Controller
{
    public function index(string $shortname, FactionRecordDatabase $database)
    {
        if (! User::hasRecordPermission(Auth::user(), $database, 'view_database')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $entries = $database->entries()
            ->with('creator:id,username')
            ->orderBy('entry_id', 'desc')
            ->get();

        $this->audit('record_entry.index', "Viewed entries for record database '{$database->name}'", $database->faction_id, $database);

        return response()->json($entries);
    }

    public function store(Request $request, string $shortname, FactionRecordDatabase $database)
    {
        if (! User::hasRecordPermission(Auth::user(), $database, 'add_entries')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($database->is_api_database) {
            return response()->json(['message' => 'This database is managed by an external API and cannot be modified manually.'], 403);
        }

        $validated = $request->validate([
            'data' => 'required|array',
            'is_active' => 'sometimes|boolean',
        ]);

        // Basic validation against structure
        $structure = $database->database_structure;
        foreach ($structure as $field) {
            if (($field['required'] ?? false) && (! isset($validated['data'][$field['id']]) || $validated['data'][$field['id']] === '')) {
                return response()->json([
                    'message' => "The {$field['name']} field is required.",
                    'errors' => [$field['id'] => ["The {$field['name']} field is required."]],
                ], 422);
            }
        }

        // Atomic increment for entry_id
        $nextEntryId = ($database->entries()->withTrashed()->max('entry_id') ?? 0) + 1;

        $entry = $database->entries()->create([
            'entry_id' => $nextEntryId,
            'data' => $validated['data'],
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => Auth::id(),
        ]);

        $this->audit('record_entry.create', "Created entry #{$entry->entry_id} in database '{$database->name}'", $database->faction_id, $entry);

        try {
            NotificationService::triggerDatabaseEntryEvent($entry, 'created');
        } catch (\Exception $e) {
            \Log::error('Failed triggering notification: '.$e->getMessage());
        }

        return response()->json($entry->load('creator:id,username'), 201);
    }

    public function show(string $shortname, FactionRecordDatabase $database, FactionRecordEntry $entry)
    {
        if (! User::hasRecordPermission(Auth::user(), $database, 'view_database')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($entry->database_id !== $database->id) {
            return response()->json(['message' => 'Entry does not belong to this database'], 404);
        }

        $this->audit('record_entry.show', "Viewed entry #{$entry->entry_id} in database '{$database->name}'", $database->faction_id, $entry);

        $entry->load('creator:id,username');
        $result = $entry->toArray();

        // Handle detail customization
        $customization = $database->detail_customization;
        if ($customization) {
            // 1. Linked Databases
            if (isset($customization['linked_databases']) && is_array($customization['linked_databases'])) {
                $linkedData = [];
                foreach ($customization['linked_databases'] as $link) {
                    $targetDb = FactionRecordDatabase::find($link['database_id']);
                    if (! $targetDb || ! User::hasRecordPermission(Auth::user(), $targetDb, 'view_database')) {
                        continue;
                    }

                    $sourceField = $link['source_field'];
                    $targetField = $link['target_field'];

                    $sourceValue = ($sourceField === 'id') ? $entry->entry_id : ($entry->data[$sourceField] ?? null);

                    if ($sourceValue !== null) {
                        $query = $targetDb->entries()
                            ->where('data->'.$targetField, $sourceValue)
                            ->with('creator:id,username');

                        // Handle exclusion of current record (useful for self-links)
                        if (isset($link['exclude_current']) && $link['exclude_current']) {
                            $query->where('id', '!=', $entry->id);
                        }

                        $linkedEntries = $query->get();

                        $linkedData[] = [
                            'config' => $link,
                            'database' => $targetDb->only(['id', 'name', 'record_shortcode', 'database_structure']),
                            'entries' => $linkedEntries,
                        ];
                    }
                }
                $result['linked_records'] = $linkedData;
            }

            // 2. Roster Integrations
            if (isset($customization['roster_integration']['enabled']) && $customization['roster_integration']['enabled']) {
                $rosterIntegrations = [];

                // 1. Find all datasets linked to this database
                $linkedDatasetIds = RosterDataset::where('record_database_id', $database->id)->pluck('id')->toArray();

                // Find all rosters in this faction
                $rosters = Roster::where('faction_id', $database->faction_id)->get();

                foreach ($rosters as $roster) {
                    if (! User::hasRosterPermission(Auth::user(), $roster, 'view_roster')) {
                        continue;
                    }

                    $rosterMatches = collect();

                    // Check all sections of this roster
                    $sections = $roster->sections()->get();
                    foreach ($sections as $section) {
                        // Determine which columns to use (section-specific or roster-default)
                        $colsToScan = collect($section->use_roster_columns ? ($roster->columns ?? []) : ($section->columns ?: ($roster->columns ?? [])));

                        $linkedCols = $colsToScan->filter(function ($col) use ($database, $linkedDatasetIds) {
                            return (($col['linked_database_id'] ?? null) == $database->id) ||
                                   (isset($col['dataset_id']) && in_array($col['dataset_id'], $linkedDatasetIds));
                        });

                        foreach ($linkedCols as $col) {
                            // Determine which field of the record is used as the label in this column
                            $fieldId = $col['database_field_id'] ?? null;
                            if (! $fieldId || in_array($fieldId, ['table', 'compact', 'cards', 'detailed', 'rows'])) {
                                $fieldId = $database->database_structure[0]['id'] ?? null;
                            }

                            if (! $fieldId) {
                                continue;
                            }

                            // Generate label(s) to match. Try common formats for robustness.
                            $labels = [];
                            if ($fieldId === 'id') {
                                $labels[] = (string) $entry->entry_id;
                            } elseif ($fieldId === 'created_at') {
                                $labels[] = $entry->created_at->toDateString();
                                $labels[] = $entry->created_at->format('m/d/Y');
                                $labels[] = $entry->created_at->format('d/m/Y');
                            } else {
                                $val = $entry->data[$fieldId] ?? null;
                                if ($val !== null) {
                                    $labels[] = (string) $val;
                                }
                            }

                            foreach ($labels as $label) {
                                $contents = RosterContent::where('section_id', $section->id)
                                    ->where('content->'.$col['id'], $label)
                                    ->with('section')
                                    ->get();

                                $rosterMatches = $rosterMatches->concat($contents);
                            }
                        }
                    }

                    if ($rosterMatches->isNotEmpty()) {
                        // Deduplicate by content ID
                        $uniqueContents = $rosterMatches->unique('id')->values();

                        // Mask hidden columns if user lacks permission
                        $canViewHidden = User::hasRosterPermission(Auth::user(), $roster, 'view_hidden_data');
                        if (! $canViewHidden) {
                            foreach ($uniqueContents as $content) {
                                $sectionCols = $content->section->use_roster_columns ? ($roster->columns ?? []) : ($content->section->columns ?: ($roster->columns ?? []));
                                $hiddenColIds = collect($sectionCols)
                                    ->filter(fn ($col) => str_contains($col['type'] ?? '', 'hidden'))
                                    ->pluck('id')
                                    ->toArray();

                                $data = $content->content;
                                if (is_array($data)) {
                                    foreach ($hiddenColIds as $colId) {
                                        if (isset($data[$colId]) && $data[$colId] !== '') {
                                            $data[$colId] = '????';
                                        }
                                    }
                                    $content->content = $data;
                                }
                            }
                        }

                        $rosterIntegrations[] = [
                            'roster' => $roster->only(['id', 'name', 'shortname', 'columns']),
                            'contents' => $uniqueContents,
                        ];
                    }
                }
                $result['roster_integrations'] = $rosterIntegrations;
            }
        }

        return response()->json($result);
    }

    public function update(Request $request, string $shortname, FactionRecordDatabase $database, FactionRecordEntry $entry)
    {
        if (! User::hasRecordPermission(Auth::user(), $database, 'modify_entries')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($entry->database_id !== $database->id) {
            return response()->json(['message' => 'Entry does not belong to this database'], 404);
        }

        if ($database->is_api_database) {
            return response()->json(['message' => 'This database is managed by an external API and cannot be modified manually.'], 403);
        }

        $validated = $request->validate([
            'data' => 'sometimes|required|array',
            'is_active' => 'sometimes|boolean',
        ]);

        // Basic validation against structure
        if (isset($validated['data'])) {
            $structure = $database->database_structure;
            foreach ($structure as $field) {
                if (($field['required'] ?? false) && (! isset($validated['data'][$field['id']]) || $validated['data'][$field['id']] === '')) {
                    return response()->json([
                        'message' => "The {$field['name']} field is required.",
                        'errors' => [$field['id'] => ["The {$field['name']} field is required."]],
                    ], 422);
                }
            }
        }

        $oldValues = $entry->getOriginal();
        $entry->update($validated);

        $this->audit('record_entry.update', "Updated entry #{$entry->entry_id} in database '{$database->name}'", $database->faction_id, $entry, $oldValues, $entry->getDirty());

        try {
            NotificationService::triggerDatabaseEntryEvent($entry, 'updated');
        } catch (\Exception $e) {
            \Log::error('Failed triggering notification: '.$e->getMessage());
        }

        return response()->json($entry->load('creator:id,username'));
    }

    public function destroy(string $shortname, FactionRecordDatabase $database, FactionRecordEntry $entry)
    {
        if (! User::hasRecordPermission(Auth::user(), $database, 'delete_entries')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($entry->database_id !== $database->id) {
            return response()->json(['message' => 'Entry does not belong to this database'], 404);
        }

        if ($database->is_api_database) {
            return response()->json(['message' => 'This database is managed by an external API and cannot be modified manually.'], 403);
        }

        $this->audit('record_entry.delete', "Deleted entry #{$entry->entry_id} in database '{$database->name}'", $database->faction_id, $entry, $entry->getAttributes());

        $entry->delete();

        return response()->json(null, 204);
    }
}
