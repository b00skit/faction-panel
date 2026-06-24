<?php

namespace App\Http\Controllers;

use App\Models\Roster;
use App\Models\RosterContent;
use App\Models\RosterRevision;
use App\Models\RosterSection;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class RosterSectionController extends Controller
{
    private function cleanUpOrphanedData($target, array $columns)
    {
        $oldColumns = $target->getOriginal('columns') ?? [];
        if (! is_array($oldColumns)) {
            $oldColumns = [];
        }

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

        $contents = RosterContent::where('section_id', $target->id)->get();

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

                    if (isset($renameMap[$colId]['checkboxes'])) {
                        $data[$cbKey] = array_map(function ($val) use ($renameMap, $colId) {
                            return $renameMap[$colId]['checkboxes'][$val] ?? $val;
                        }, $data[$cbKey]);
                    }

                    $data[$cbKey] = array_values(array_intersect($data[$cbKey], $valids['checkboxes']));

                    if ($original !== $data[$cbKey]) {
                        $changed = true;
                    }
                }

                // Handle Tags
                $tagKey = "{$colId}_tags";
                if (isset($data[$tagKey]) && is_array($data[$tagKey])) {
                    $original = $data[$tagKey];

                    if (isset($renameMap[$colId]['tags'])) {
                        $data[$tagKey] = array_map(function ($val) use ($renameMap, $colId) {
                            return $renameMap[$colId]['tags'][$val] ?? $val;
                        }, $data[$tagKey]);
                    }

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

    public function store(Request $request, Roster $roster)
    {
        if (! User::hasRosterPermission(Auth::user(), $roster, 'add_sections')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'image_url' => 'nullable|string|url',
            'shortname' => 'required|string|max:6',
            'color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'type' => 'required|in:master,section,subsection,content',
            'data_source' => 'sometimes|in:manual,dynamic',
            'parent_id' => 'nullable|exists:roster_sections,id',
            'section_options' => 'nullable|array',
            'columns' => 'nullable|array',
            'layout_settings' => 'nullable|array',
            'subsections_per_row' => 'nullable|integer|min:1|max:3',
            'content_html' => 'nullable|string',
        ]);

        $validated['shortname'] = strtoupper($validated['shortname']);

        // Validation: master sections cannot have parents
        if ($validated['type'] === 'master' && ! empty($validated['parent_id'])) {
            return response()->json(['message' => 'Master sections cannot have a parent'], 422);
        }

        // Only one master section per roster
        if ($validated['type'] === 'master') {
            $exists = $roster->sections()->where('type', 'master')->exists();
            if ($exists) {
                return response()->json(['message' => 'A master section already exists for this roster.'], 422);
            }
        }

        // Get next order within the same parent or root
        $maxOrder = $roster->sections()
            ->where('parent_id', $validated['parent_id'] ?? null)
            ->max('order') ?? -1;

        $columns = $validated['columns'] ?? $roster->columns;

        $section = $roster->sections()->create([
            ...$validated,
            'columns' => $columns,
            'order' => $maxOrder + 1,
            'created_by' => Auth::id(),
        ]);

        $this->audit('roster_section.create', "Created roster section '{$section->name}' in roster '{$roster->name}'", $roster->faction_id, $section, null, $section->getAttributes());

        RosterRevision::logRevision($roster->id, "Created section '{$section->name}'", Auth::id());

        return response()->json($section, 201);
    }

    public function update(Request $request, RosterSection $section)
    {
        if (! User::hasRosterPermission(Auth::user(), $section->roster, 'add_sections')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'image_url' => 'sometimes|nullable|string|url',
            'shortname' => 'sometimes|required|string|max:6',
            'color' => ['sometimes', 'nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'type' => 'sometimes|in:master,section,subsection,content',
            'data_source' => 'sometimes|in:manual,dynamic',
            'parent_id' => 'sometimes|nullable|exists:roster_sections,id',
            'section_options' => 'sometimes|nullable|array',
            'columns' => 'sometimes|nullable|array',
            'use_roster_columns' => 'sometimes|boolean',
            'layout_settings' => 'sometimes|nullable|array',
            'counts' => 'sometimes|nullable|array',
            'subsections_per_row' => 'sometimes|integer|min:1|max:3',
            'content_html' => 'sometimes|nullable|string',
        ]);

        if (isset($validated['shortname'])) {
            $validated['shortname'] = strtoupper($validated['shortname']);
        }

        $oldValues = $section->getOriginal();
        $section->update($validated);

        if (isset($validated['columns'])) {
            $this->cleanUpOrphanedData($section, $validated['columns']);
        }

        $this->audit('roster_section.update', "Updated roster section '{$section->name}'", $section->roster->faction_id, $section, $oldValues, $section->getDirty());

        RosterRevision::logRevision($section->roster_id, "Updated section '{$section->name}'", Auth::id());

        return response()->json($section);
    }

    public function destroy(RosterSection $section)
    {
        if (! User::hasRosterPermission(Auth::user(), $section->roster, 'remove_sections')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($section->type === 'master') {
            return response()->json(['message' => 'The master section cannot be deleted'], 422);
        }

        $this->audit('roster_section.delete', "Deleted roster section '{$section->name}'", $section->roster->faction_id, $section, $section->getAttributes());
        $section->delete();

        RosterRevision::logRevision($section->roster_id, "Deleted section '{$section->name}'", Auth::id());

        return response()->json(['message' => 'Section deleted']);
    }

    public function reorder(Request $request, Roster $roster)
    {
        if (! User::hasRosterPermission(Auth::user(), $roster, 'add_sections')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'section_ids' => 'required|array',
            'section_ids.*' => 'exists:roster_sections,id',
            'parent_id' => 'nullable|exists:roster_sections,id',
        ]);

        foreach ($request->section_ids as $index => $id) {
            RosterSection::where('id', $id)
                ->where('roster_id', $roster->id)
                ->update([
                    'order' => $index,
                    'parent_id' => $request->parent_id,
                ]);
        }

        $this->audit('roster_section.reorder', "Reordered sections in roster '{$roster->name}'", $roster->faction_id, $roster, null, ['section_ids' => $request->section_ids, 'parent_id' => $request->parent_id]);

        RosterRevision::logRevision($roster->id, 'Reordered sections', Auth::id());

        \App\Events\RosterUpdated::dispatch($roster);

        return response()->json(['message' => 'Order updated']);
    }
}
