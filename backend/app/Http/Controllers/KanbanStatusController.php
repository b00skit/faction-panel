<?php

namespace App\Http\Controllers;

use App\Events\KanbanBoardUpdated;
use App\Models\KanbanProject;
use App\Models\KanbanStatus;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class KanbanStatusController extends Controller
{
    private function checkAccess(KanbanProject $project, string $permissionKey = 'manage_statuses')
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

        return User::hasProjectPermission($user, $project, $permissionKey) || User::hasProjectPermission($user, $project, 'modify_card');
    }

    public function store(Request $request, KanbanProject $project)
    {
        if (!$this->checkAccess($project, 'manage_statuses')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'is_visible' => 'sometimes|boolean',
        ]);

        $maxOrder = $project->statuses()->max('order') ?? -1;

        $status = $project->statuses()->create([
            'name' => $validated['name'],
            'is_visible' => $validated['is_visible'] ?? true,
            'order' => $maxOrder + 1,
        ]);

        $this->audit('kanban.status.create', "Created status '{$status->name}' for project '{$project->name}'", null, $project, null, $status->getAttributes());

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'status_created');

        return response()->json($status, 201);
    }

    public function update(Request $request, KanbanStatus $status)
    {
        $project = $status->project;
        if (!$this->checkAccess($project, 'manage_statuses')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'is_visible' => 'sometimes|boolean',
        ]);

        if ($status->is_default && isset($validated['is_visible']) && ! $validated['is_visible']) {
            return response()->json(['message' => 'The default status column must remain visible on the board.'], 422);
        }

        $oldValues = $status->getOriginal();
        $status->update($validated);

        $this->audit('kanban.status.update', "Updated status '{$status->name}' in project '{$project->name}'", null, $project, $oldValues, $status->getDirty());

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'status_updated');

        return response()->json($status);
    }

    public function destroy(KanbanStatus $status)
    {
        $project = $status->project;
        if (!$this->checkAccess($project, 'manage_statuses')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($status->is_default) {
            return response()->json(['message' => 'The default status column cannot be deleted.'], 422);
        }

        $this->audit('kanban.status.delete', "Deleted status '{$status->name}' in project '{$project->name}'", null, $project, $status->getAttributes());

        $status->delete();

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'status_deleted');

        return response()->json(['message' => 'Status deleted']);
    }

    public function reorder(Request $request, KanbanProject $project)
    {
        if (!$this->checkAccess($project, 'manage_statuses')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'status_order' => 'required|array',
            'status_order.*' => 'required|integer|exists:kanban_statuses,id',
        ]);

        foreach ($validated['status_order'] as $index => $id) {
            $project->statuses()->where('id', $id)->update(['order' => $index]);
        }

        $this->audit('kanban.status.reorder', "Reordered statuses in project '{$project->name}'");

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'statuses_reordered');

        return response()->json(['message' => 'Statuses reordered']);
    }
}
