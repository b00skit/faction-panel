<?php

namespace App\Http\Controllers;

use App\Events\KanbanBoardUpdated;
use App\Models\KanbanHtmlCard;
use App\Models\KanbanProject;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class KanbanHtmlCardController extends Controller
{
    private function canManage(KanbanProject $project)
    {
        $user = Auth::user();
        if ($user->is_superadmin) {
            return true;
        }

        $faction = $project->faction;
        if ($faction->faction_leader === $user->id) {
            return true;
        }

        if (User::hasFactionPermission($user, $faction, 'global_kanban_moderation')) {
            return true;
        }

        if ($project->created_by === $user->id) {
            return true;
        }

        return User::hasProjectPermission($user, $project, 'modify_card') ||
               User::hasProjectPermission($user, $project, 'modify_project');
    }

    public function index(KanbanProject $project)
    {
        $user = Auth::user();
        if (! User::canViewProject($user, $project)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($project->htmlCards);
    }

    public function store(Request $request, KanbanProject $project)
    {
        if (! $this->canManage($project)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'status_id' => 'required|integer|exists:kanban_statuses,id',
            'content' => 'nullable|string',
            'position' => 'sometimes|string|in:top,bottom',
            'order' => 'sometimes|integer',
        ]);

        // Ensure status belongs to this project
        $project->statuses()->findOrFail($validated['status_id']);

        $user = Auth::user();
        $htmlCard = $project->htmlCards()->create([
            'status_id' => $validated['status_id'],
            'name' => $validated['name'],
            'content' => $validated['content'] ?? '',
            'position' => $validated['position'] ?? 'top',
            'order' => $validated['order'] ?? 0,
            'created_by' => $user->id,
        ]);

        $this->audit('kanban.html_card.create', "Created HTML card '{$htmlCard->name}' for project '{$project->name}'", null, $project, null, $htmlCard->getAttributes());

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'html_card_created');

        return response()->json($htmlCard, 201);
    }

    public function update(Request $request, KanbanHtmlCard $htmlCard)
    {
        $project = $htmlCard->project;
        if (! $this->canManage($project)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'status_id' => 'sometimes|required|integer|exists:kanban_statuses,id',
            'content' => 'nullable|string',
            'position' => 'sometimes|string|in:top,bottom',
            'order' => 'sometimes|integer',
        ]);

        if (isset($validated['status_id'])) {
            $project->statuses()->findOrFail($validated['status_id']);
        }

        $oldValues = $htmlCard->getOriginal();
        $htmlCard->update($validated);

        $this->audit('kanban.html_card.update', "Updated HTML card '{$htmlCard->name}' in project '{$project->name}'", null, $project, $oldValues, $htmlCard->getDirty());

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'html_card_updated');

        return response()->json($htmlCard);
    }

    public function destroy(KanbanHtmlCard $htmlCard)
    {
        $project = $htmlCard->project;
        if (! $this->canManage($project)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('kanban.html_card.delete', "Deleted HTML card '{$htmlCard->name}' in project '{$project->name}'", null, $project, $htmlCard->getAttributes());

        $htmlCard->delete();

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'html_card_deleted');

        return response()->json(['message' => 'HTML card deleted']);
    }
}
