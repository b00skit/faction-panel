<?php

namespace App\Http\Controllers;

use App\Models\RosterContent;
use App\Models\RosterRevision;
use App\Models\RosterSection;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;

class RosterContentController extends Controller
{
    public function store(Request $request, RosterSection $section)
    {
        $roster = $section->roster;
        $user = Auth::user();

        if (! User::hasRosterPermission($user, $roster, 'edit_predefined')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'type' => 'required|string|in:predefined,defined,spacer',
            'color' => 'nullable|string',
            'content' => 'nullable|array',
        ]);

        if (isset($validated['content'])) {
            $canViewHidden = User::hasRosterPermission($user, $roster, 'view_hidden_data');

            if (! $canViewHidden) {
                $sectionCols = $section->use_roster_columns ? ($roster->columns ?? []) : ($section->columns ?: ($roster->columns ?? []));
                $hiddenColIds = collect($sectionCols)
                    ->filter(fn ($col) => str_contains($col['type'] ?? '', 'hidden'))
                    ->pluck('id')
                    ->toArray();

                foreach ($hiddenColIds as $colId) {
                    if (array_key_exists($colId, $validated['content'])) {
                        unset($validated['content'][$colId]);
                    }
                }
            }
        }

        $maxOrder = $section->contents()->max('order') ?? -1;

        $content = $section->contents()->create([
            ...$validated,
            'order' => $maxOrder + 1,
            'created_by' => Auth::id(),
        ]);

        $this->audit('roster.content.create', "Created roster content for section '{$section->name}' in roster '{$roster->name}'", null, $content, null, $content->getAttributes());

        RosterRevision::logRevision($roster->id, "Created row in section '{$section->name}'", Auth::id());

        try {
            NotificationService::triggerRosterContentEvent($content, 'created');
        } catch (\Exception $e) {
            \Log::error('Failed triggering notification: '.$e->getMessage());
        }

        return response()->json($content, 201);
    }

    public function update(Request $request, RosterContent $content)
    {
        $roster = $content->section->roster;

        $user = Auth::user();
        $canEditDefined = User::hasRosterPermission($user, $roster, 'modify_roster');
        $canEditPredefined = User::hasRosterPermission($user, $roster, 'edit_predefined');

        if (! $canEditDefined && ! $canEditPredefined) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'type' => 'sometimes|string|in:predefined,defined,spacer',
            'color' => 'sometimes|nullable|string',
            'content' => 'sometimes|array',
            'order' => 'sometimes|integer',
            'last_updated_at' => 'sometimes|string',
            'force' => 'sometimes|boolean',
        ]);

        // Conflict detection
        if (! $request->force && isset($validated['last_updated_at'])) {
            $lastUpdated = Carbon::parse($validated['last_updated_at']);

            // Get the last user who updated this
            $lastAudit = $content->audits()->where('event', 'updated')->latest('id')->first();
            $lastUpdatedByMe = $lastAudit && $lastAudit->user_id === $user->id;

            // Use timestamp comparison with 1s buffer for precision mismatches
            if ($content->updated_at->timestamp > ($lastUpdated->timestamp + 1) && ! $lastUpdatedByMe) {
                return response()->json([
                    'message' => 'This row was recently updated by another user.',
                    'conflict' => true,
                    'current_data' => $content->content,
                    'updated_at' => $content->updated_at,
                    'updated_by' => $lastAudit?->user?->username ?? 'Another user',
                    'updated_by_id' => $lastAudit?->user_id,
                ], 409);
            }
        }

        if (isset($validated['content'])) {
            $canViewHidden = User::hasRosterPermission($user, $roster, 'view_hidden_data');

            if (! $canViewHidden) {
                $sectionCols = $content->section->use_roster_columns ? ($roster->columns ?? []) : ($content->section->columns ?: ($roster->columns ?? []));
                $hiddenColIds = collect($sectionCols)
                    ->filter(fn ($col) => str_contains($col['type'] ?? '', 'hidden'))
                    ->pluck('id')
                    ->toArray();

                $existingContent = $content->content ?? [];
                foreach ($hiddenColIds as $colId) {
                    if (array_key_exists($colId, $existingContent)) {
                        $validated['content'][$colId] = $existingContent[$colId];
                    } else {
                        unset($validated['content'][$colId]);
                    }
                }
            }
        }

        $oldValues = $content->getOriginal();
        $content->update([
            ...$validated,
            'editing_by' => null,
            'editing_at' => null,
            'editing_col' => null,
        ]);

        $this->audit('roster.content.update', "Updated roster content in section '{$content->section->name}' in roster '{$roster->name}'", null, $content, $oldValues, $content->getDirty());

        RosterRevision::logRevision($roster->id, "Updated row in section '{$content->section->name}'", Auth::id());

        try {
            NotificationService::triggerRosterContentEvent($content, 'updated');
        } catch (\Exception $e) {
            \Log::error('Failed triggering notification: '.$e->getMessage());
        }

        return response()->json($content);
    }

    public function lock(Request $request, RosterContent $content)
    {
        $roster = $content->section->roster;
        $user = Auth::user();

        if (! User::hasRosterPermission($user, $roster, 'modify_roster') &&
            ! User::hasRosterPermission($user, $roster, 'edit_predefined')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $content->timestamps = false;
        $content->update([
            'editing_by' => $user->id,
            'editing_at' => now(),
            'editing_col' => $request->col_id,
        ]);

        $this->audit('roster.content.lock', "Locked roster content column '{$request->col_id}' in section '{$content->section->name}' in roster '{$roster->name}'", null, $content);

        return response()->json(['message' => 'Locked successfully']);
    }

    public function unlock(RosterContent $content)
    {
        if ($content->editing_by === Auth::id()) {
            $content->timestamps = false;
            $content->update([
                'editing_by' => null,
                'editing_at' => null,
                'editing_col' => null,
            ]);
        }

        $this->audit('roster.content.unlock', "Unlocked roster content in section '{$content->section->name}' in roster '{$content->section->roster->name}'", null, $content);

        return response()->json(['message' => 'Unlocked successfully']);
    }

    public function destroy(RosterContent $content)
    {
        $roster = $content->section->roster;

        if (! User::hasRosterPermission(Auth::user(), $roster, 'edit_predefined')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('roster.content.delete', "Deleted roster content from section '{$content->section->name}' in roster '{$roster->name}'", null, $content, $content->getAttributes());

        $content->delete();

        RosterRevision::logRevision($roster->id, "Deleted row from section '{$content->section->name}'", Auth::id());

        return response()->json(['message' => 'Content deleted']);
    }

    public function reorder(Request $request, RosterSection $section)
    {
        $roster = $section->roster;
        if (! User::hasRosterPermission(Auth::user(), $roster, 'edit_predefined')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'content_ids' => 'required|array',
            'content_ids.*' => 'exists:roster_contents,id',
        ]);

        foreach ($request->content_ids as $index => $id) {
            RosterContent::where('id', $id)
                ->where('section_id', $section->id)
                ->update(['order' => $index]);
        }

        $this->audit('roster.content.reorder', "Reordered roster content for section '{$section->name}' in roster '{$roster->name}'", null, $section, null, $request->content_ids);

        RosterRevision::logRevision($roster->id, "Reordered rows in section '{$section->name}'", Auth::id());

        return response()->json(['message' => 'Reordered successfully']);
    }

    public function batchUpdate(Request $request, RosterSection $section)
    {
        $roster = $section->roster;
        $user = Auth::user();

        $canEditDefined = User::hasRosterPermission($user, $roster, 'modify_roster');
        $canEditPredefined = User::hasRosterPermission($user, $roster, 'edit_predefined');

        if (! $canEditDefined && ! $canEditPredefined) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'contents' => 'required|array',
            'contents.*.id' => 'required|exists:roster_contents,id',
            'contents.*.content' => 'sometimes|array',
            'contents.*.type' => 'sometimes|string|in:predefined,defined,spacer',
            'contents.*.color' => 'sometimes|nullable|string',
            'contents.*.order' => 'sometimes|integer',
        ]);

        $contentIds = collect($request->contents)->pluck('id')->toArray();
        $contents = RosterContent::whereIn('id', $contentIds)
            ->where('section_id', $section->id)
            ->get()
            ->keyBy('id');

        $canViewHidden = User::hasRosterPermission($user, $roster, 'view_hidden_data');
        $hiddenColIds = [];
        if (! $canViewHidden) {
            $sectionCols = $section->use_roster_columns ? ($roster->columns ?? []) : ($section->columns ?: ($roster->columns ?? []));
            $hiddenColIds = collect($sectionCols)
                ->filter(fn ($col) => str_contains($col['type'] ?? '', 'hidden'))
                ->pluck('id')
                ->toArray();
        }

        foreach ($request->contents as $item) {
            $contentModel = $contents->get($item['id']);
            if (! $contentModel) {
                continue;
            }

            $updateData = collect($item)->only(['content', 'type', 'color', 'order'])->toArray();

            if (isset($updateData['content'])) {
                if (! $canViewHidden) {
                    $existingContent = $contentModel->content ?? [];
                    foreach ($hiddenColIds as $colId) {
                        if (array_key_exists($colId, $existingContent)) {
                            $updateData['content'][$colId] = $existingContent[$colId];
                        } else {
                            unset($updateData['content'][$colId]);
                        }
                    }
                }
            }

            $contentModel->update($updateData);

            try {
                NotificationService::triggerRosterContentEvent($contentModel, 'updated');
            } catch (\Exception $e) {
                \Log::error('Failed triggering notification: '.$e->getMessage());
            }
        }

        $this->audit('roster.content.batch_update', "Batch updated roster content for section '{$section->name}' in roster '{$roster->name}'", null, $section, null, $request->contents);

        RosterRevision::logRevision($roster->id, "Batch updated rows in section '{$section->name}'", Auth::id());

        return response()->json(['message' => 'Batch update successful']);
    }
}
