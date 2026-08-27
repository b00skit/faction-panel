<?php

namespace App\Http\Controllers;

use App\Events\KanbanBoardUpdated;
use App\Models\KanbanCard;
use App\Models\KanbanSubtask;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class KanbanSubtaskController extends Controller
{
    private function canModifySubtask(KanbanSubtask $subtask)
    {
        $card = $subtask->card;

        return $this->canModifyCard($card);
    }

    private function canModifyCard(KanbanCard $card)
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

        return User::hasProjectPermission($user, $project, 'modify_card');
    }

    public function store(Request $request, KanbanCard $card)
    {
        if (! $this->canModifyCard($card)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
        ]);

        $maxOrder = $card->subtasks()->max('order') ?? -1;

        $subtask = $card->subtasks()->create([
            'title' => $validated['title'],
            'is_completed' => false,
            'order' => $maxOrder + 1,
        ]);

        $project = $card->project;
        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, $card->id, 'subtask_created');

        return response()->json($subtask, 201);
    }

    public function update(Request $request, KanbanSubtask $subtask)
    {
        if (! $this->canModifySubtask($subtask)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'is_completed' => 'sometimes|required|boolean',
        ]);

        $subtask->update($validated);

        $project = $subtask->card->project;
        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, $subtask->card_id, 'subtask_updated');

        return response()->json($subtask);
    }

    public function destroy(KanbanSubtask $subtask)
    {
        if (! $this->canModifySubtask($subtask)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $cardId = $subtask->card_id;
        $project = $subtask->card->project;

        $subtask->delete();

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, $cardId, 'subtask_deleted');

        return response()->json(['message' => 'Subtask deleted']);
    }

    public function reorder(Request $request, KanbanCard $card)
    {
        if (! $this->canModifyCard($card)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'subtask_order' => 'required|array',
            'subtask_order.*' => 'required|integer|exists:kanban_subtasks,id',
        ]);

        foreach ($validated['subtask_order'] as $index => $id) {
            $card->subtasks()->where('id', $id)->update(['order' => $index]);
        }

        $project = $card->project;
        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, $card->id, 'subtasks_reordered');

        return response()->json(['message' => 'Subtasks reordered']);
    }
}
