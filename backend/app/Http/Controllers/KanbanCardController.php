<?php

namespace App\Http\Controllers;

use App\Events\KanbanBoardUpdated;
use App\Models\KanbanCard;
use App\Models\KanbanProject;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class KanbanCardController extends Controller
{
    private function canViewDetails(KanbanCard $card)
    {
        $user = Auth::user();
        if ($user->is_superadmin) {
            return true;
        }

        $project = $card->project;
        $faction = $project->faction;

        if ($faction->faction_leader === $user->id ||
            User::hasFactionPermission($user, $faction, 'global_kanban_moderation') ||
            $project->created_by === $user->id ||
            $card->created_by === $user->id
        ) {
            return true;
        }

        return User::hasProjectPermission($user, $project, 'view_card_details');
    }

    private function canModifyCard(KanbanCard $card, string $permissionKey = 'modify_card')
    {
        $user = Auth::user();
        if ($user->is_superadmin) {
            return true;
        }

        $project = $card->project;
        $faction = $project->faction;

        if ($faction->faction_leader === $user->id ||
            User::hasFactionPermission($user, $faction, 'global_kanban_moderation') ||
            $project->created_by === $user->id ||
            $card->created_by === $user->id
        ) {
            return true;
        }

        return User::hasProjectPermission($user, $project, $permissionKey);
    }

    public function show(KanbanCard $card)
    {
        if (!$this->canViewDetails($card)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $card->load([
            'subtasks',
            'comments.user',
            'assignees',
            'labels',
            'cardType',
            'priority'
        ]);

        return response()->json($card);
    }

    public function store(Request $request, KanbanProject $project)
    {
        $user = Auth::user();
        $canAdd = User::hasProjectPermission($user, $project, 'add_card') ||
            $user->is_superadmin ||
            $project->faction->faction_leader === $user->id ||
            User::hasFactionPermission($user, $project->faction, 'global_kanban_moderation') ||
            $project->created_by === $user->id;

        if (!$canAdd) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'status_id' => 'required|integer|exists:kanban_statuses,id',
            'row_id' => 'nullable|integer|exists:kanban_rows,id',
            'card_type_id' => 'required|integer|exists:kanban_card_types,id',
            'priority_id' => 'nullable|integer|exists:kanban_priorities,id',
        ]);

        // Verify status belongs to project
        $status = $project->statuses()->findOrFail($validated['status_id']);

        $maxOrder = $status->cards()->max('order') ?? -1;

        $priorityId = $validated['priority_id'] ?? (\App\Models\KanbanPriority::where('is_default', true)->value('id') ?? \App\Models\KanbanPriority::value('id'));
        $rowId = $validated['row_id'] ?? ($project->rows()->where('is_default', true)->value('id') ?? $project->rows()->value('id'));

        $card = KanbanCard::create([
            'project_id' => $project->id,
            'status_id' => $status->id,
            'row_id' => $rowId,
            'card_type_id' => $validated['card_type_id'],
            'priority_id' => $priorityId,
            'title' => $validated['title'],
            'order' => $maxOrder + 1,
            'created_by' => $user->id,
        ]);

        $this->audit('kanban.card.create', "Created card '{$card->title}' in status '{$status->name}' of project '{$project->name}'", null, $project, null, $card->getAttributes());

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, $card->id, 'card_created');

        return response()->json($card->load(['assignees', 'labels', 'cardType', 'priority', 'row']), 201);
    }

    public function update(Request $request, KanbanCard $card)
    {
        if (!$this->canModifyCard($card, 'modify_card')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'card_type_id' => 'sometimes|required|integer|exists:kanban_card_types,id',
            'priority_id' => 'sometimes|nullable|integer|exists:kanban_priorities,id',
            'row_id' => 'sometimes|nullable|integer|exists:kanban_rows,id',
            'assignees' => 'sometimes|array',
            'assignees.*' => 'integer|exists:users,id',
            'labels' => 'sometimes|array',
            'labels.*' => 'integer|exists:kanban_labels,id',
        ]);

        $project = $card->project;
        $oldValues = $card->getOriginal();

        // Update card attributes
        $cardFields = $request->only(['title', 'description', 'color', 'card_type_id', 'priority_id', 'row_id']);
        if (!empty($cardFields)) {
            $card->update($cardFields);
        }

        // Sync assignees
        if ($request->has('assignees')) {
            // Filter superadmins out (Requirement: Skip superadmins)
            $userIds = $validated['assignees'];
            $nonSuperadmins = User::whereIn('id', $userIds)->where('is_superadmin', false)->pluck('id')->toArray();
            $card->assignees()->sync($nonSuperadmins);
        }

        // Sync labels
        if ($request->has('labels')) {
            // Ensure labels belong to this project
            $labelIds = $validated['labels'];
            $validLabels = $project->labels()->whereIn('id', $labelIds)->pluck('id')->toArray();
            $card->labels()->sync($validLabels);
        }

        $this->audit('kanban.card.update', "Updated card '{$card->title}' in project '{$project->name}'", null, $project, $oldValues, $card->getDirty());

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, $card->id, 'card_updated');

        return response()->json($card->load(['subtasks', 'comments.user', 'assignees', 'labels', 'cardType', 'priority']));
    }

    public function destroy(KanbanCard $card)
    {
        if (!$this->canModifyCard($card, 'modify_card')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $project = $card->project;

        $this->audit('kanban.card.delete', "Deleted card '{$card->title}' in project '{$project->name}'", null, $project, $card->getAttributes());

        $card->delete();

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'card_deleted');

        return response()->json(['message' => 'Card deleted']);
    }

    public function move(Request $request, KanbanCard $card)
    {
        // Require modify_card permission to move card
        if (!$this->canModifyCard($card, 'modify_card')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'status_id' => 'sometimes|required|integer|exists:kanban_statuses,id',
            'row_id' => 'sometimes|nullable|integer|exists:kanban_rows,id',
            'card_order' => 'sometimes|required|array',
            'card_order.*' => 'required|integer|exists:kanban_cards,id',
            'source_card_order' => 'nullable|array',
            'source_card_order.*' => 'required|integer|exists:kanban_cards,id',
        ]);

        $project = $card->project;

        if (isset($validated['row_id']) && $card->row_id !== $validated['row_id']) {
            $card->row_id = $validated['row_id'];
            $card->save();
        }

        if (isset($validated['status_id'])) {
            $targetStatus = $project->statuses()->findOrFail($validated['status_id']);

            // Update status of this card if it changed
            $oldStatusId = $card->status_id;
            if ($card->status_id !== $targetStatus->id) {
                $card->status_id = $targetStatus->id;
                $card->save();
            }

            if (isset($validated['card_order'])) {
                // Apply new orders in target column
                foreach ($validated['card_order'] as $index => $id) {
                    KanbanCard::where('id', $id)->update(['order' => $index, 'status_id' => $targetStatus->id]);
                }
            }

            if ($oldStatusId !== $targetStatus->id && !empty($validated['source_card_order'])) {
                foreach ($validated['source_card_order'] as $index => $id) {
                    KanbanCard::where('id', $id)->update(['order' => $index, 'status_id' => $oldStatusId]);
                }
            }
        }

        // Apply source column reorder if provided (when moving between columns)
        if ($oldStatusId !== $targetStatus->id && !empty($validated['source_card_order'])) {
            foreach ($validated['source_card_order'] as $index => $id) {
                KanbanCard::where('id', $id)->update(['order' => $index, 'status_id' => $oldStatusId]);
            }
        }

        $this->audit('kanban.card.move', "Moved card '{$card->title}' to status '{$targetStatus->name}' in project '{$project->name}'");

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, $card->id, 'card_moved');

        return response()->json(['message' => 'Card moved successfully']);
    }

    public function archiveCard(KanbanCard $card)
    {
        if (!$this->canModifyCard($card, 'modify_card')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $card->is_archived = true;
        $card->save();

        $project = $card->project;
        $this->audit('kanban.card.archive', "Archived card '{$card->title}' in project '{$project->name}'", null, $project, null, $card->getAttributes());

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, $card->id, 'card_archived');

        return response()->json($card);
    }

    public function restoreCard(KanbanCard $card)
    {
        if (!$this->canModifyCard($card, 'modify_card')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $card->is_archived = false;
        $card->save();

        $project = $card->project;
        $this->audit('kanban.card.restore', "Restored card '{$card->title}' from archive in project '{$project->name}'", null, $project, null, $card->getAttributes());

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, $card->id, 'card_restored');

        return response()->json($card);
    }

    public function activity(Request $request, KanbanCard $card)
    {
        if (!$this->canViewDetails($card)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Fetch comments with user
        $comments = $card->comments()->with('user')->get()->map(function ($comment) {
            return [
                'id' => 'comment_' . $comment->id,
                'type' => 'comment',
                'user' => $comment->user,
                'comment' => $comment->comment,
                'created_at' => $comment->created_at->toIso8601String(),
                'raw_id' => $comment->id,
            ];
        });

        // Fetch audits with user
        $audits = $card->audits()->with('user')->get()->map(function ($audit) {
            return [
                'id' => 'audit_' . $audit->id,
                'type' => 'action',
                'user' => $audit->user,
                'event' => $audit->event,
                'description' => $audit->description,
                'old_values' => $audit->old_values,
                'new_values' => $audit->new_values,
                'created_at' => $audit->created_at->toIso8601String(),
                'raw_id' => $audit->id,
            ];
        });

        // Combine and sort by created_at desc
        $feed = $comments->concat($audits)->sortByDesc('created_at')->values();

        // Paginate
        $page = (int) $request->query('page', 1);
        $perPage = 10;
        $offset = ($page - 1) * $perPage;

        $sliced = $feed->slice($offset, $perPage)->values();

        return response()->json([
            'data' => $sliced,
            'current_page' => $page,
            'per_page' => $perPage,
            'total' => $feed->count(),
            'last_page' => (int) ceil($feed->count() / $perPage),
        ]);
    }
}
