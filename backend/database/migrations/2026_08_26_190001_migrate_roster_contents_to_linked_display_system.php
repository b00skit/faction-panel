<?php

use App\Models\FactionRecordDatabase;
use App\Models\FactionRecordEntry;
use App\Models\RosterContent;
use App\Models\RosterDataset;
use App\Models\RosterSection;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::transaction(function () {
            $sections = RosterSection::with('roster.faction')->get()->keyBy('id');
            $datasets = RosterDataset::with('options')->get()->keyBy('id');
            $allDatabases = FactionRecordDatabase::all();

            $dbEntries = FactionRecordEntry::withTrashed()->get();
            $entriesByDbAndEntryId = [];
            $entriesByDbAndName = [];
            foreach ($dbEntries as $entry) {
                $entriesByDbAndEntryId[$entry->database_id][$entry->entry_id] = $entry;
                $name = $entry->data['name'] ?? $entry->data['character_name'] ?? $entry->data['Character Name'] ?? null;
                if ($name) {
                    $entriesByDbAndName[$entry->database_id][strtolower(trim($name))] = $entry;
                }
            }

            RosterContent::withTrashed()->chunkById(100, function ($contents) use ($sections, $datasets, $allDatabases, $entriesByDbAndEntryId, $entriesByDbAndName) {
                foreach ($contents as $content) {
                    $section = $sections->get($content->section_id);
                    if (! $section) {
                        continue;
                    }
                    $roster = $section->roster;
                    if (! $roster) {
                        continue;
                    }

                    $columns = $section->use_roster_columns ? ($roster->columns ?? []) : ($section->columns ?: ($roster->columns ?? []));
                    if (! is_array($columns)) {
                        continue;
                    }

                    $data = $content->content;
                    if (! is_array($data)) {
                        continue;
                    }

                    $linkedId = is_array($content->linked_id) ? $content->linked_id : [];
                    $linkedDisplay = is_array($content->linked_display) ? $content->linked_display : [];
                    $changed = false;

                    foreach ($columns as $col) {
                        $colId = $col['id'] ?? null;
                        if (! $colId) {
                            continue;
                        }

                        $val = $data[$colId] ?? null;
                        if ($val === null || $val === '') {
                            continue;
                        }

                        // Determine linked database ID
                        $dbId = null;
                        if (isset($col['linked_database_id']) && $col['linked_database_id']) {
                            $dbId = FactionRecordDatabase::resolveDatabaseId($col['linked_database_id'], $allDatabases);
                        } elseif (isset($col['dataset_id']) && $col['dataset_id']) {
                            $ds = $datasets->get($col['dataset_id']);
                            if ($ds && $ds->record_database_id) {
                                $dbId = FactionRecordDatabase::resolveDatabaseId($ds->record_database_id, $allDatabases);
                            }
                        }

                        // 1. Cross-roster link
                        if (is_array($val) && isset($val['row_id'], $val['col_id'])) {
                            $targetContent = RosterContent::find($val['row_id']);
                            $targetVal = ($targetContent && is_array($targetContent->content)) ? ($targetContent->content[$val['col_id']] ?? '-') : '-';
                            if (is_array($targetVal)) {
                                $targetVal = '-';
                            }
                            $linkedId[$colId] = $val;
                            $linkedDisplay[$colId] = (string) $targetVal;
                            $data[$colId] = (string) $targetVal;
                            $changed = true;

                            continue;
                        }

                        // 2. Database link
                        if ($dbId) {
                            if (is_numeric($val) && filter_var($val, FILTER_VALIDATE_INT) !== false) {
                                $entryId = (int) $val;
                                $entry = $entriesByDbAndEntryId[$dbId][$entryId] ?? null;
                                $fieldId = $col['database_field_id'] ?? null;

                                if ($entry) {
                                    $display = ($fieldId && $fieldId !== 'id')
                                        ? ($entry->data[$fieldId] ?? $entry->data['name'] ?? $entry->data['character_name'] ?? (string) $entryId)
                                        : ($entry->data['name'] ?? $entry->data['character_name'] ?? $entry->data['Character Name'] ?? (string) $entryId);

                                    $linkedId[$colId] = $entryId;
                                    $linkedDisplay[$colId] = (string) $display;
                                    $data[$colId] = (string) $display;
                                    $changed = true;
                                }
                            } elseif (is_string($val)) {
                                $entry = $entriesByDbAndName[$dbId][strtolower(trim($val))] ?? null;
                                if ($entry) {
                                    $linkedId[$colId] = $entry->entry_id;
                                    $linkedDisplay[$colId] = $val;
                                    $data[$colId] = $val;
                                    $changed = true;
                                } else {
                                    $linkedDisplay[$colId] = $val;
                                }
                            }

                            continue;
                        }

                        // 3. Pure Dataset Option link
                        if (isset($col['dataset_id']) && $col['dataset_id']) {
                            $ds = $datasets->get($col['dataset_id']);
                            if ($ds && is_numeric($val) && filter_var($val, FILTER_VALIDATE_INT) !== false) {
                                $optId = (int) $val;
                                $opt = $ds->options->firstWhere('id', $optId);
                                if ($opt) {
                                    $linkedId[$colId] = $optId;
                                    $linkedDisplay[$colId] = (string) $opt->value;
                                    $data[$colId] = (string) $opt->value;
                                    $changed = true;
                                }
                            }
                        }
                    }

                    if ($changed) {
                        $content->updateQuietly([
                            'linked_id' => $linkedId,
                            'linked_display' => $linkedDisplay,
                            'content' => $data,
                        ]);
                    }
                }
            });
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op for data migration
    }
};
