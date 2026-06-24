<?php

namespace App\Http\Controllers;

use App\Models\Roster;
use App\Models\RosterRevision;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class RosterPermissionController extends Controller
{
    public function index(Roster $roster)
    {
        if ($roster->is_sandbox) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $faction = $roster->faction;
        if (! User::hasFactionPermission(Auth::user(), $faction, 'global_roster_moderation') && $roster->created_by !== Auth::id()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('roster_permission.index', "Viewed permissions for roster '{$roster->name}'", $faction->id, $roster);

        return response()->json($roster->rosterPermissions()->with(['group', 'role'])->get());
    }

    public function update(Request $request, Roster $roster)
    {
        if ($roster->is_sandbox) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $faction = $roster->faction;
        if (! User::hasFactionPermission(Auth::user(), $faction, 'global_roster_moderation') && $roster->created_by !== Auth::id()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'group_id' => 'nullable|exists:groups,id', // NULL for Public or when role is set
            'role_id' => 'nullable|exists:roles,id',
            'permissions' => 'required|array',
        ]);

        $existingPermission = $roster->rosterPermissions()
            ->where('group_id', $validated['group_id'] ?? null)
            ->where('role_id', $validated['role_id'] ?? null)
            ->first();
        $oldValues = $existingPermission ? $existingPermission->getOriginal() : null;

        // If both are null, it's public. If one is set, it's for that specific target.
        $rosterPermission = $roster->rosterPermissions()->updateOrCreate(
            [
                'group_id' => $validated['group_id'],
                'role_id' => $validated['role_id'],
            ],
            ['permissions' => $validated['permissions']]
        );

        $this->audit(
            $existingPermission ? 'roster_permission.update' : 'roster_permission.create',
            $existingPermission ? "Updated permissions on roster '{$roster->name}'" : "Created permissions on roster '{$roster->name}'",
            $faction->id,
            $rosterPermission,
            $oldValues,
            $rosterPermission->getDirty()
        );

        RosterRevision::logRevision($roster->id, 'Updated permissions', Auth::id());

        return response()->json($rosterPermission->load(['group', 'role']));
    }

    public function destroy(Roster $roster, $permissionId)
    {
        if ($roster->is_sandbox) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $faction = $roster->faction;
        if (! User::hasFactionPermission(Auth::user(), $faction, 'global_roster_moderation') && $roster->created_by !== Auth::id()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $permission = $roster->rosterPermissions()->findOrFail($permissionId);
        $this->audit('roster_permission.delete', "Deleted permissions on roster '{$roster->name}'", $faction->id, $permission, $permission->getAttributes());
        $permission->delete();

        RosterRevision::logRevision($roster->id, 'Deleted permissions entry', Auth::id());

        return response()->json(['message' => 'Permission removed']);
    }

    public function getExclusions(Roster $roster)
    {
        if ($roster->is_sandbox) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $faction = $roster->faction;
        if (! User::hasFactionPermission(Auth::user(), $faction, 'global_roster_moderation') && $roster->created_by !== Auth::id()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($roster->exclusions()->with('role')->get());
    }

    public function addExclusion(Request $request, Roster $roster)
    {
        if ($roster->is_sandbox) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $faction = $roster->faction;
        if (! User::hasFactionPermission(Auth::user(), $faction, 'global_roster_moderation') && $roster->created_by !== Auth::id()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'role_id' => 'required|exists:roles,id',
        ]);

        $exclusion = $roster->exclusions()->updateOrCreate([
            'role_id' => $validated['role_id'],
        ]);

        $this->audit('roster_exclusion.create', "Excluded role '{$exclusion->role->name}' from roster '{$roster->name}'", $faction->id, $exclusion);
        RosterRevision::logRevision($roster->id, "Excluded role '{$exclusion->role->name}'", Auth::id());

        return response()->json($exclusion->load('role'));
    }

    public function removeExclusion(Roster $roster, $roleId)
    {
        if ($roster->is_sandbox) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $faction = $roster->faction;
        if (! User::hasFactionPermission(Auth::user(), $faction, 'global_roster_moderation') && $roster->created_by !== Auth::id()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $exclusion = $roster->exclusions()->where('role_id', $roleId)->firstOrFail();

        $roleName = $exclusion->role ? $exclusion->role->name : "Role #{$roleId}";
        $this->audit('roster_exclusion.delete', "Removed exclusion for role '{$roleName}' from roster '{$roster->name}'", $faction->id, $exclusion, $exclusion->getAttributes());
        $exclusion->delete();

        RosterRevision::logRevision($roster->id, "Removed exclusion for role '{$roleName}'", Auth::id());

        return response()->json(['message' => 'Exclusion removed']);
    }
}
