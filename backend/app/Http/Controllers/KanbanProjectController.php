<?php

namespace App\Http\Controllers;

use App\Events\KanbanBoardUpdated;
use App\Models\Faction;
use App\Models\KanbanProject;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class KanbanProjectController extends Controller
{
    public function index($shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::guard('sanctum')->user();

        $projects = $faction->kanbanProjects()
            ->with([
                'permissions', 'labels',
                'statuses.cards.assignees', 'statuses.cards.labels', 'statuses.cards.cardType', 'statuses.cards.priority', 'statuses.cards.subtasks', 'statuses.cards.comments',
                'rows.cards.assignees', 'rows.cards.labels', 'rows.cards.cardType', 'rows.cards.priority', 'rows.cards.subtasks', 'rows.cards.comments',
            ])
            ->orderBy('order')
            ->orderBy('id')
            ->get();

        // Filter projects by canViewProject
        $filtered = $projects->filter(function ($project) use ($user) {
            return User::canViewProject($user, $project);
        });

        // Map permission set for each project
        $mapped = $filtered->map(function ($project) use ($user) {
            return $this->sanitizeProjectForUser($project, $user);
        })->values();

        $this->audit('kanban.project.list', "Viewed Kanban projects list for faction {$faction->name}");

        return response()->json($mapped);
    }

    public function store(Request $request, $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::user();

        if (! User::hasFactionPermission($user, $faction, 'create_project')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'color' => ['required', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'description' => 'nullable|string|max:1000',
            'prefix' => 'nullable|string|max:10',
            'show_prefix' => 'sometimes|boolean',
            'enable_project_management' => 'sometimes|boolean',
        ]);

        $maxOrder = $faction->kanbanProjects()->max('order') ?? -1;

        $project = $faction->kanbanProjects()->create([
            'name' => $validated['name'],
            'color' => $validated['color'],
            'description' => $validated['description'] ?? null,
            'prefix' => $validated['prefix'] ?? null,
            'show_prefix' => $validated['show_prefix'] ?? true,
            'enable_project_management' => $validated['enable_project_management'] ?? false,
            'order' => $maxOrder + 1,
            'created_by' => $user->id,
        ]);

        // Automatically create default columns/statuses
        $project->statuses()->createMany([
            ['name' => 'To Do', 'order' => 0, 'is_default' => true],
            ['name' => 'In Progress', 'order' => 1, 'is_default' => false],
            ['name' => 'Done', 'order' => 2, 'is_default' => false],
        ]);

        // Automatically create default row
        $project->rows()->create([
            'name' => 'Default',
            'order' => 0,
            'is_visible' => true,
            'is_default' => true,
        ]);

        $this->audit('kanban.project.create', "Created Kanban project '{$project->name}' for faction '{$faction->name}'", null, $project, null, $project->getAttributes());

        return response()->json($this->sanitizeProjectForUser($project->load([
            'permissions', 'labels',
            'statuses.cards.assignees', 'statuses.cards.labels', 'statuses.cards.cardType', 'statuses.cards.priority', 'statuses.cards.subtasks', 'statuses.cards.comments',
            'rows.cards.assignees', 'rows.cards.labels', 'rows.cards.cardType', 'rows.cards.priority', 'rows.cards.subtasks', 'rows.cards.comments',
        ]), $user), 201);
    }

    public function update(Request $request, KanbanProject $project)
    {
        $user = Auth::user();
        $canModify = User::hasProjectPermission($user, $project, 'modify_project') ||
            $user->is_superadmin ||
            $project->faction->faction_leader === $user->id ||
            User::hasFactionPermission($user, $project->faction, 'global_kanban_moderation') ||
            $project->created_by === $user->id;

        if (! $canModify) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'color' => ['sometimes', 'required', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'description' => 'sometimes|nullable|string|max:1000',
            'prefix' => 'sometimes|nullable|string|max:10',
            'show_prefix' => 'sometimes|boolean',
            'enable_project_management' => 'sometimes|boolean',
            'created_by' => 'sometimes|nullable|integer|exists:users,id',
        ]);

        $oldValues = $project->getOriginal();
        $project->update($validated);

        $this->audit('kanban.project.update', "Updated Kanban project '{$project->name}'", null, $project, $oldValues, $project->getDirty());

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'project_updated');

        return response()->json($this->sanitizeProjectForUser($project->load(['permissions', 'labels', 'statuses.cards.assignees', 'statuses.cards.labels', 'statuses.cards.cardType', 'statuses.cards.priority', 'statuses.cards.subtasks', 'statuses.cards.comments']), $user));
    }

    public function destroy(KanbanProject $project)
    {
        $user = Auth::user();
        $canModify = User::hasProjectPermission($user, $project, 'modify_project') ||
            $user->is_superadmin ||
            $project->faction->faction_leader === $user->id ||
            User::hasFactionPermission($user, $project->faction, 'global_kanban_moderation') ||
            $project->created_by === $user->id;

        if (! $canModify) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('kanban.project.delete', "Deleted Kanban project '{$project->name}'", null, $project, $project->getAttributes());

        $project->delete();

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, null, 'project_deleted');

        return response()->json(['message' => 'Project deleted']);
    }

    public function reorder(Request $request, $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::user();

        if (! User::hasFactionPermission($user, $faction, 'global_kanban_moderation')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'project_order' => 'required|array',
            'project_order.*' => 'required|integer|exists:kanban_projects,id',
        ]);

        foreach ($validated['project_order'] as $index => $id) {
            $faction->kanbanProjects()->where('id', $id)->update(['order' => $index]);
        }

        $this->audit('kanban.project.reorder', "Reordered Kanban projects for faction '{$faction->name}'");

        // Broadcast to faction channel using one of the projects to represent it
        $firstId = $validated['project_order'][0] ?? 0;
        if ($firstId) {
            KanbanBoardUpdated::dispatch($faction->id, $firstId, null, 'projects_reordered');
        }

        return response()->json(['message' => 'Projects reordered']);
    }

    public function getAssignees(KanbanProject $project)
    {
        $faction = $project->faction;
        $user = Auth::user();

        if (! User::canViewProject($user, $project)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $allMembers = $faction->users()->where('is_superadmin', false)->get();
        $assignees = $allMembers->filter(function ($member) use ($project, $faction) {
            // Always include faction administrators (users with administrator role permission)
            $factionPermissions = User::getFactionPermissions($member, $faction);
            if (in_array('administrator', $factionPermissions)) {
                return true;
            }

            // Also include the faction leader
            if ($faction->faction_leader === $member->id) {
                return true;
            }

            return User::hasProjectPermission($member, $project, 'view_card_details');
        })->map(function ($member) {
            return [
                'id' => $member->id,
                'username' => $member->username,
                'avatar_url' => $member->avatar_url,
            ];
        })->values();

        return response()->json($assignees);
    }

    public function archivedCards(KanbanProject $project)
    {
        $user = Auth::user();
        if (! User::canViewProject($user, $project)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $hasViewCardDetails = $user && (
            $user->is_superadmin ||
            $project->faction->faction_leader === $user->id ||
            User::hasFactionPermission($user, $project->faction, 'global_kanban_moderation') ||
            $project->created_by === $user->id ||
            User::hasProjectPermission($user, $project, 'view_card_details')
        );

        $cards = $project->cards()
            ->where('is_archived', true)
            ->with(['assignees', 'labels', 'cardType', 'priority', 'status', 'comments', 'subtasks'])
            ->orderBy('updated_at', 'desc')
            ->get();

        $cards->map(function ($card) use ($user, $hasViewCardDetails) {
            return $this->sanitizeCardForUser($card, $user, $hasViewCardDetails);
        });

        return response()->json($cards);
    }

    private function sanitizeCardForUser($card, $user, $hasViewCardDetails)
    {
        $canViewCardSpecific = $hasViewCardDetails || ($user && $card->created_by === $user->id);
        if (! $canViewCardSpecific) {
            $card->description = ! empty($card->description);

            $commentsCount = $card->comments ? $card->comments->count() : 0;
            $card->unsetRelation('comments');
            $card->setAttribute('comments', $commentsCount > 0 ? $commentsCount : null);

            $totalSubtasks = $card->subtasks ? $card->subtasks->count() : 0;
            $completedSubtasks = $card->subtasks ? $card->subtasks->where('is_completed', true)->count() : 0;
            $card->unsetRelation('subtasks');
            $card->setAttribute('subtasks', $totalSubtasks > 0 ? ['completed' => $completedSubtasks, 'total' => $totalSubtasks] : null);
        }

        return $card;
    }

    private function sanitizeProjectForUser($project, $user)
    {
        // First make sure we load everything needed if not loaded
        if (! $project->relationLoaded('statuses') || ! $project->relationLoaded('rows')) {
            $project->load([
                'permissions', 'labels',
                'statuses.cards.assignees', 'statuses.cards.labels', 'statuses.cards.cardType', 'statuses.cards.priority', 'statuses.cards.subtasks', 'statuses.cards.comments',
                'rows.cards.assignees', 'rows.cards.labels', 'rows.cards.cardType', 'rows.cards.priority', 'rows.cards.subtasks', 'rows.cards.comments',
            ]);
        } else {
            // Ensure cards relations are loaded for status columns
            foreach ($project->statuses as $status) {
                if (! $status->relationLoaded('cards')) {
                    $status->load('cards.assignees', 'cards.labels', 'cards.cardType', 'cards.priority', 'cards.subtasks', 'cards.comments');
                }
            }
            foreach ($project->rows as $row) {
                if (! $row->relationLoaded('cards')) {
                    $row->load('cards.assignees', 'cards.labels', 'cards.cardType', 'cards.priority', 'cards.subtasks', 'cards.comments');
                }
            }
        }

        $hasViewCardDetails = $user && (
            $user->is_superadmin ||
            $project->faction->faction_leader === $user->id ||
            User::hasFactionPermission($user, $project->faction, 'global_kanban_moderation') ||
            $project->created_by === $user->id ||
            User::hasProjectPermission($user, $project, 'view_card_details')
        );

        $project->user_permissions = [
            'view_project' => User::hasProjectPermission($user, $project, 'view_project'),
            'add_card' => User::hasProjectPermission($user, $project, 'add_card'),
            'modify_card' => User::hasProjectPermission($user, $project, 'modify_card'),
            'view_card_details' => $hasViewCardDetails,
            'manage_statuses' => User::hasProjectPermission($user, $project, 'manage_statuses'),
            'manage_labels' => User::hasProjectPermission($user, $project, 'manage_labels'),
            'modify_project' => User::hasProjectPermission($user, $project, 'modify_project') || (
                $user && ($user->is_superadmin || $project->faction->faction_leader === $user->id || User::hasFactionPermission($user, $project->faction, 'global_kanban_moderation') || $project->created_by === $user->id)
            ),
        ];

        if (isset($project->statuses)) {
            foreach ($project->statuses as $status) {
                if (isset($status->cards)) {
                    foreach ($status->cards as $card) {
                        $this->sanitizeCardForUser($card, $user, $hasViewCardDetails);
                    }
                }
            }
        }

        if (isset($project->rows)) {
            foreach ($project->rows as $row) {
                if (isset($row->cards)) {
                    foreach ($row->cards as $card) {
                        $this->sanitizeCardForUser($card, $user, $hasViewCardDetails);
                    }
                }
            }
        }

        return $project;
    }
}
