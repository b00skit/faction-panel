<?php

namespace App\Http\Controllers;

use App\Events\KanbanBoardUpdated;
use App\Models\KanbanLabel;
use App\Models\KanbanProject;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class KanbanLabelController extends Controller
{
    private function checkAccess(KanbanProject $project, string $permissionKey = 'manage_labels')
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

        return User::hasProjectPermission($user, $project, $permissionKey);
    }

    public function index(KanbanProject $project)
    {
        $user = Auth::user();
        if (! User::canViewProject($user, $project)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($project->labels);
    }

    public function store(Request $request, KanbanProject $project)
    {
        if (! $this->checkAccess($project, 'manage_labels')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'color' => ['required', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
        ]);

        $label = $project->labels()->create($validated);

        $this->audit('kanban.label.create', "Created label '{$label->name}' for project '{$project->name}'", null, $project, null, $label->getAttributes());

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'label_created');

        return response()->json($label, 201);
    }

    public function update(Request $request, KanbanLabel $label)
    {
        $project = $label->project;
        if (! $this->checkAccess($project, 'manage_labels')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'color' => ['sometimes', 'required', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
        ]);

        $oldValues = $label->getOriginal();
        $label->update($validated);

        $this->audit('kanban.label.update', "Updated label '{$label->name}' in project '{$project->name}'", null, $project, $oldValues, $label->getDirty());

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'label_updated');

        return response()->json($label);
    }

    public function destroy(KanbanLabel $label)
    {
        $project = $label->project;
        if (! $this->checkAccess($project, 'manage_labels')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('kanban.label.delete', "Deleted label '{$label->name}' in project '{$project->name}'", null, $project, $label->getAttributes());

        $label->delete();

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'label_deleted');

        return response()->json(['message' => 'Label deleted']);
    }
}
