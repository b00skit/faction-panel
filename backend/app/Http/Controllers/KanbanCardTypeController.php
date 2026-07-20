<?php

namespace App\Http\Controllers;

use App\Models\Faction;
use App\Models\KanbanCardType;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class KanbanCardTypeController extends Controller
{
    private function canManageGlobal(Request $request)
    {
        $user = Auth::user();
        if ($user->is_superadmin) {
            return true;
        }

        $shortname = $request->header('X-Faction-Shortname') ?: $request->input('shortname');
        if ($shortname) {
            $faction = Faction::where('shortname', $shortname)->first();
            if ($faction && User::hasFactionPermission($user, $faction, 'global_kanban_moderation')) {
                return true;
            }
        }

        return false;
    }

    public function index()
    {
        // Seed defaults if empty
        if (KanbanCardType::count() === 0) {
            KanbanCardType::create([
                'name' => 'Task',
                'color' => '#3b82f6',
                'icon' => 'CheckSquare',
                'settings' => [
                    'description' => true,
                    'subtasks' => true,
                    'color' => true,
                    'icon' => true,
                    'comments' => true,
                    'assignee' => true,
                    'priority' => true,
                ],
            ]);
            KanbanCardType::create([
                'name' => 'Story',
                'color' => '#10b981',
                'icon' => 'Bookmark',
                'settings' => [
                    'description' => true,
                    'subtasks' => true,
                    'color' => true,
                    'icon' => true,
                    'comments' => true,
                    'assignee' => true,
                    'priority' => true,
                ],
            ]);
            KanbanCardType::create([
                'name' => 'Bug',
                'color' => '#ef4444',
                'icon' => 'ShieldAlert',
                'settings' => [
                    'description' => true,
                    'subtasks' => true,
                    'color' => true,
                    'icon' => true,
                    'comments' => true,
                    'assignee' => true,
                    'priority' => true,
                ],
            ]);
        }

        return response()->json(KanbanCardType::all());
    }

    public function store(Request $request)
    {
        if (!$this->canManageGlobal($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'color' => ['required', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'icon' => 'required|string|max:255',
            'settings' => 'required|array',
            'settings.description' => 'required|boolean',
            'settings.subtasks' => 'required|boolean',
            'settings.color' => 'required|boolean',
            'settings.icon' => 'required|boolean',
            'settings.comments' => 'required|boolean',
            'settings.assignee' => 'required|boolean',
            'settings.priority' => 'required|boolean',
        ]);

        $cardType = KanbanCardType::create($validated);

        $this->audit('kanban.card_type.create', "Created card type '{$cardType->name}'", null, null, null, $cardType->getAttributes());

        return response()->json($cardType, 201);
    }

    public function update(Request $request, KanbanCardType $cardType)
    {
        if (!$this->canManageGlobal($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'color' => ['sometimes', 'required', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'icon' => 'sometimes|required|string|max:255',
            'settings' => 'sometimes|required|array',
            'settings.description' => 'sometimes|required|boolean',
            'settings.subtasks' => 'sometimes|required|boolean',
            'settings.color' => 'sometimes|required|boolean',
            'settings.icon' => 'sometimes|required|boolean',
            'settings.comments' => 'sometimes|required|boolean',
            'settings.assignee' => 'sometimes|required|boolean',
            'settings.priority' => 'sometimes|required|boolean',
        ]);

        $oldValues = $cardType->getOriginal();
        $cardType->update($validated);

        $this->audit('kanban.card_type.update', "Updated card type '{$cardType->name}'", null, null, $oldValues, $cardType->getDirty());

        return response()->json($cardType);
    }

    public function destroy(Request $request, KanbanCardType $cardType)
    {
        if (!$this->canManageGlobal($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('kanban.card_type.delete', "Deleted card type '{$cardType->name}'", null, null, $cardType->getAttributes());

        $cardType->delete();

        return response()->json(['message' => 'Card type deleted']);
    }
}
