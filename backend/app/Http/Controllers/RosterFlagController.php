<?php

namespace App\Http\Controllers;

use App\Models\Faction;
use App\Models\RosterFlag;
use App\Models\User;
use App\Services\RosterFlagService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class RosterFlagController extends Controller
{
    public function index($shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();

        $this->audit('roster_flag.index', "Viewed roster flags for faction '{$faction->name}'", null, $faction);

        return response()->json($faction->rosterFlags()->get());
    }

    public function store(Request $request, $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        if (! User::hasFactionPermission(Auth::user(), $faction, 'modify_roster_flags')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'icon' => 'nullable|string|max:50',
            'color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'rules' => 'array',
            'excluded_roster_ids' => 'nullable|array',
        ]);

        $flag = $faction->rosterFlags()->create([
            'name' => $validated['name'],
            'icon' => $validated['icon'] ?? 'Flag',
            'color' => $validated['color'] ?? '#3b82f6',
            'rules' => $validated['rules'] ?? [],
            'excluded_roster_ids' => $validated['excluded_roster_ids'] ?? [],
            'created_by' => Auth::id(),
        ]);

        $this->audit('roster_flag.create', "Created roster flag '{$flag->name}' for faction '{$faction->name}'", null, $flag, null, $flag->getAttributes());

        return response()->json($flag, 201);
    }

    public function update(Request $request, RosterFlag $flag)
    {
        if (! User::hasFactionPermission(Auth::user(), $flag->faction, 'modify_roster_flags')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'icon' => 'sometimes|nullable|string|max:50',
            'color' => ['sometimes', 'nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'rules' => 'sometimes|array',
            'excluded_roster_ids' => 'sometimes|nullable|array',
        ]);

        $oldValues = $flag->getOriginal();
        $flag->update($validated);
        $this->audit('roster_flag.update', "Updated roster flag '{$flag->name}'", null, $flag, $oldValues, $flag->getDirty());

        return response()->json($flag);
    }

    public function destroy(RosterFlag $flag)
    {
        if (! User::hasFactionPermission(Auth::user(), $flag->faction, 'modify_roster_flags')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('roster_flag.delete', "Deleted roster flag '{$flag->name}'", null, $flag, $flag->getAttributes());
        $flag->delete();

        return response()->json(['message' => 'Flag deleted']);
    }

    public function recalculate(RosterFlag $flag, RosterFlagService $service)
    {
        if (! User::hasFactionPermission(Auth::user(), $flag->faction, 'modify_roster_flags')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $modified = $service->recalculate($flag);

        $this->audit('roster_flag.recalculate', "Recalculated roster flag '{$flag->name}' — {$modified} row(s) updated", null, $flag);

        return response()->json([
            'message' => 'Flag recalculated',
            'modified' => $modified,
        ]);
    }
}
