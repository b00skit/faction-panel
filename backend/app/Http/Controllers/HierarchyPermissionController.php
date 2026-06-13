<?php

namespace App\Http\Controllers;

use App\Models\Hierarchy;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class HierarchyPermissionController extends Controller
{
    public function index(Hierarchy $hierarchy)
    {
        $faction = $hierarchy->faction;
        if (! User::hasFactionPermission(Auth::user(), $faction, 'global_hierarchy_moderation') && $hierarchy->created_by !== Auth::id()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('hierarchy_permission.index', "Viewed permissions for hierarchy '{$hierarchy->name}'", $faction->id, $hierarchy);

        return response()->json($hierarchy->hierarchyPermissions()->with(['group', 'role'])->get());
    }

    public function update(Request $request, Hierarchy $hierarchy)
    {
        $faction = $hierarchy->faction;
        if (! User::hasFactionPermission(Auth::user(), $faction, 'global_hierarchy_moderation') && $hierarchy->created_by !== Auth::id()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'group_id' => 'nullable|exists:groups,id',
            'role_id' => 'nullable|exists:roles,id',
            'permissions' => 'required|array',
        ]);

        $existingPermission = $hierarchy->hierarchyPermissions()
            ->where('group_id', $validated['group_id'] ?? null)
            ->where('role_id', $validated['role_id'] ?? null)
            ->first();
        $oldValues = $existingPermission ? $existingPermission->getOriginal() : null;

        $hierarchyPermission = $hierarchy->hierarchyPermissions()->updateOrCreate(
            [
                'group_id' => $validated['group_id'],
                'role_id' => $validated['role_id'],
            ],
            ['permissions' => $validated['permissions']]
        );

        $this->audit(
            $existingPermission ? 'hierarchy_permission.update' : 'hierarchy_permission.create',
            $existingPermission ? "Updated permissions on hierarchy '{$hierarchy->name}'" : "Created permissions on hierarchy '{$hierarchy->name}'",
            $faction->id,
            $hierarchyPermission,
            $oldValues,
            $hierarchyPermission->getDirty()
        );

        return response()->json($hierarchyPermission->load(['group', 'role']));
    }

    public function destroy(Hierarchy $hierarchy, $permissionId)
    {
        $faction = $hierarchy->faction;
        if (! User::hasFactionPermission(Auth::user(), $faction, 'global_hierarchy_moderation') && $hierarchy->created_by !== Auth::id()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $permission = $hierarchy->hierarchyPermissions()->findOrFail($permissionId);
        $this->audit('hierarchy_permission.delete', "Deleted permissions on hierarchy '{$hierarchy->name}'", $faction->id, $permission, $permission->getAttributes());
        $permission->delete();

        return response()->json(['message' => 'Permission removed']);
    }
}
