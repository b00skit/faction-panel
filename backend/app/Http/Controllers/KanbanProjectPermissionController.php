<?php

namespace App\Http\Controllers;

use App\Events\KanbanBoardUpdated;
use App\Models\KanbanProject;
use App\Models\KanbanProjectPermission;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class KanbanProjectPermissionController extends Controller
{
    private function checkAccess(KanbanProject $project)
    {
        $user = Auth::user();
        $isOwner = $project->created_by === $user->id;
        $isLeader = $project->faction->faction_leader === $user->id;
        $isGlobalMod = User::hasFactionPermission($user, $project->faction, 'global_kanban_moderation');

        return $user->is_superadmin || $isOwner || $isLeader || $isGlobalMod;
    }

    public function index(KanbanProject $project)
    {
        if (! $this->checkAccess($project)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($project->permissions);
    }

    public function update(Request $request, KanbanProject $project)
    {
        if (! $this->checkAccess($project)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'group_id' => 'nullable|integer|exists:groups,id',
            'role_id' => 'nullable|integer|exists:roles,id',
            'permissions' => 'required|array',
            'permissions.*' => 'string',
        ]);

        $permission = KanbanProjectPermission::updateOrCreate(
            [
                'project_id' => $project->id,
                'group_id' => $validated['group_id'],
                'role_id' => $validated['role_id'],
            ],
            [
                'permissions' => $validated['permissions'],
            ]
        );

        $this->audit('kanban.permission.update', "Updated permissions for Kanban project '{$project->name}'", null, $project, null, $permission->getAttributes());

        User::clearPermissionsCache();
        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'project_permissions_updated');

        return response()->json($permission);
    }

    public function destroy(KanbanProject $project, $permissionId)
    {
        if (! $this->checkAccess($project)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $permission = KanbanProjectPermission::where('project_id', $project->id)
            ->findOrFail($permissionId);

        $this->audit('kanban.permission.delete', "Deleted permission entry for Kanban project '{$project->name}'", null, $project, $permission->getAttributes());

        $permission->delete();

        User::clearPermissionsCache();
        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'project_permissions_deleted');

        return response()->json(['message' => 'Permission removed']);
    }
}
