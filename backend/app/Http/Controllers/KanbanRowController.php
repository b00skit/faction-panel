<?php

namespace App\Http\Controllers;

use App\Events\KanbanBoardUpdated;
use App\Models\KanbanProject;
use App\Models\KanbanRow;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class KanbanRowController extends Controller
{
    private function checkAccess(KanbanProject $project)
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

        return User::hasProjectPermission($user, $project, 'manage_statuses') || User::hasProjectPermission($user, $project, 'modify_card') || User::hasProjectPermission($user, $project, 'modify_project');
    }

    public function store(Request $request, KanbanProject $project)
    {
        if (! $this->checkAccess($project)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'is_visible' => 'sometimes|boolean',
        ]);

        $maxOrder = $project->rows()->max('order') ?? -1;

        $row = $project->rows()->create([
            'name' => $validated['name'],
            'is_visible' => $validated['is_visible'] ?? true,
            'is_default' => false,
            'order' => $maxOrder + 1,
        ]);

        $this->audit('kanban.row.create', "Created row '{$row->name}' for project '{$project->name}'", null, $project, null, $row->getAttributes());

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'row_created');

        return response()->json($row, 201);
    }

    public function update(Request $request, KanbanRow $row)
    {
        $project = $row->project;
        if (! $this->checkAccess($project)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'is_visible' => 'sometimes|boolean',
        ]);

        $oldValues = $row->getOriginal();
        $row->update($validated);

        $this->audit('kanban.row.update', "Updated row '{$row->name}' in project '{$project->name}'", null, $project, $oldValues, $row->getDirty());

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'row_updated');

        return response()->json($row);
    }

    public function destroy(KanbanRow $row)
    {
        $project = $row->project;
        if (! $this->checkAccess($project)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($row->is_default) {
            return response()->json(['message' => 'The default row cannot be deleted.'], 422);
        }

        $this->audit('kanban.row.delete', "Deleted row '{$row->name}' in project '{$project->name}'", null, $project, $row->getAttributes());

        $row->delete();

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'row_deleted');

        return response()->json(['message' => 'Row deleted']);
    }

    public function reorder(Request $request, KanbanProject $project)
    {
        if (! $this->checkAccess($project)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'row_order' => 'required|array',
            'row_order.*' => 'required|integer|exists:kanban_rows,id',
        ]);

        foreach ($validated['row_order'] as $index => $id) {
            $project->rows()->where('id', $id)->update(['order' => $index]);
        }

        $this->audit('kanban.row.reorder', "Reordered rows in project '{$project->name}'");

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'rows_reordered');

        return response()->json(['message' => 'Rows reordered']);
    }
}
