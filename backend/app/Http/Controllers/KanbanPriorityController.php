<?php

namespace App\Http\Controllers;

use App\Models\Faction;
use App\Models\KanbanPriority;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class KanbanPriorityController extends Controller
{
    private function canManageGlobal(Request $request)
    {
        $user = Auth::user();
        if (! $user) {
            return false;
        }
        if ($user->is_superadmin) {
            return true;
        }

        $factions = Faction::all();
        foreach ($factions as $faction) {
            if ($faction->faction_leader === $user->id || User::hasFactionPermission($user, $faction, 'global_kanban_moderation')) {
                return true;
            }
        }

        return false;
    }

    public function index()
    {
        // Seed defaults if empty
        if (KanbanPriority::count() === 0) {
            KanbanPriority::create([
                'name' => 'Low',
                'color' => '#94a3b8',
                'icon' => 'ArrowDown',
                'order' => 0,
                'is_default' => false,
            ]);
            KanbanPriority::create([
                'name' => 'Medium',
                'color' => '#3b82f6',
                'icon' => 'ArrowRight',
                'order' => 1,
                'is_default' => true,
            ]);
            KanbanPriority::create([
                'name' => 'High',
                'color' => '#f97316',
                'icon' => 'ArrowUp',
                'order' => 2,
                'is_default' => false,
            ]);
            KanbanPriority::create([
                'name' => 'Urgent',
                'color' => '#ef4444',
                'icon' => 'Flame',
                'order' => 3,
                'is_default' => false,
            ]);
        }

        return response()->json(KanbanPriority::orderBy('order')->orderBy('id')->get());
    }

    public function store(Request $request)
    {
        if (! $this->canManageGlobal($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'color' => ['required', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'icon' => 'required|string|max:255',
            'order' => 'required|integer',
            'is_default' => 'required|boolean',
        ]);

        if ($validated['is_default']) {
            KanbanPriority::where('is_default', true)->update(['is_default' => false]);
        }

        $priority = KanbanPriority::create($validated);

        $this->audit('kanban.priority.create', "Created priority '{$priority->name}'", null, null, null, $priority->getAttributes());

        return response()->json($priority, 201);
    }

    public function update(Request $request, KanbanPriority $priority)
    {
        if (! $this->canManageGlobal($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'color' => ['sometimes', 'required', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'icon' => 'sometimes|required|string|max:255',
            'order' => 'sometimes|required|integer',
            'is_default' => 'sometimes|required|boolean',
        ]);

        if (isset($validated['is_default']) && $validated['is_default']) {
            KanbanPriority::where('id', '!=', $priority->id)->where('is_default', true)->update(['is_default' => false]);
        }

        $oldValues = $priority->getOriginal();
        $priority->update($validated);

        $this->audit('kanban.priority.update', "Updated priority '{$priority->name}'", null, null, $oldValues, $priority->getDirty());

        return response()->json($priority);
    }

    public function destroy(Request $request, KanbanPriority $priority)
    {
        if (! $this->canManageGlobal($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('kanban.priority.delete', "Deleted priority '{$priority->name}'", null, null, $priority->getAttributes());

        $priority->delete();

        return response()->json(['message' => 'Priority deleted']);
    }
}
