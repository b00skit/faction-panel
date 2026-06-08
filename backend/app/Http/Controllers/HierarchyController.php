<?php

namespace App\Http\Controllers;

use App\Models\Faction;
use App\Models\Hierarchy;
use App\Models\RosterContent;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class HierarchyController extends Controller
{
    public function index($shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::guard('sanctum')->user();

        $isGlobalViewer = User::hasFactionPermission($user, $faction, 'view_faction_hierarchy');

        $hierarchies = $faction->hierarchies()
            ->with(['hierarchyPermissions'])
            ->orderBy('order')
            ->orderBy('id')
            ->get();

        $filteredHierarchies = $hierarchies->filter(function ($hierarchy) use ($user, $isGlobalViewer) {
            $hasExplicitPerms = $hierarchy->hierarchyPermissions->isNotEmpty();
            if ($hasExplicitPerms) {
                return User::hasHierarchyPermission($user, $hierarchy, 'view_hierarchy');
            }
            return $isGlobalViewer || User::hasHierarchyPermission($user, $hierarchy, 'view_hierarchy');
        });

        if ($filteredHierarchies->isEmpty() && !$isGlobalViewer) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $resolvedHierarchies = $filteredHierarchies->map(function ($hierarchy) use ($user) {
            // Fetch root nodes recursively
            $rootNodes = $hierarchy->rootNodes()->get();
            
            // Resolve roster contents for slots
            $allNodes = $hierarchy->nodes()->get();
            $rosterContentIds = [];
            foreach ($allNodes as $node) {
                // If auto-link is enabled, fetch the relevant rows in the section and add their IDs
                if (!empty($node->roster_sync_config['enabled']) && !empty($node->roster_sync_config['section_id'])) {
                    $secId = (int)$node->roster_sync_config['section_id'];
                    $rows = RosterContent::where('section_id', $secId)->orderBy('order')->orderBy('id')->get();
                    $start = isset($node->roster_sync_config['row_start']) ? (int)$node->roster_sync_config['row_start'] : 1;
                    $end = isset($node->roster_sync_config['row_end']) ? (int)$node->roster_sync_config['row_end'] : null;
                    
                    $offset = max(0, $start - 1);
                    $limit = $end ? ($end - $start + 1) : null;
                    
                    if ($limit !== null) {
                        $rows = $rows->slice($offset, $limit);
                    } else {
                        $rows = $rows->slice($offset);
                    }
                    
                    foreach ($rows as $row) {
                        $rosterContentIds[] = $row->id;
                    }
                }

                // Also fetch manually linked slots
                $slots = $node->slots ?? [];
                foreach ($slots as $slot) {
                    if (!empty($slot['roster_content_id'])) {
                        $rosterContentIds[] = $slot['roster_content_id'];
                    }
                }
            }

            $rosterContents = [];
            if (!empty($rosterContentIds)) {
                $rosterContents = RosterContent::whereIn('id', array_unique($rosterContentIds))
                    ->with('section.roster')
                    ->get()
                    ->keyBy('id');
            }

            // Recursive function to attach children and resolve slots
            $resolveNode = function ($node) use (&$resolveNode, $rosterContents) {
                if (!empty($node->roster_sync_config['enabled']) && !empty($node->roster_sync_config['section_id'])) {
                    $secId = (int)$node->roster_sync_config['section_id'];
                    $start = isset($node->roster_sync_config['row_start']) ? (int)$node->roster_sync_config['row_start'] : 1;
                    $end = isset($node->roster_sync_config['row_end']) ? (int)$node->roster_sync_config['row_end'] : null;
                    $keyCol = !empty($node->roster_sync_config['key_col']) ? $node->roster_sync_config['key_col'] : 'rank';
                    $valueCol = !empty($node->roster_sync_config['value_col']) ? $node->roster_sync_config['value_col'] : 'name';
                    
                    $rows = RosterContent::where('section_id', $secId)->orderBy('order')->orderBy('id')->get();
                    $offset = max(0, $start - 1);
                    $limit = $end ? ($end - $start + 1) : null;
                    if ($limit !== null) {
                        $rows = $rows->slice($offset, $limit);
                    } else {
                        $rows = $rows->slice($offset);
                    }
                    
                    $dynamicSlots = [];
                    foreach ($rows as $row) {
                        $labelColor = $node->roster_sync_config['label_color'] ?? null;
                        $labelBold = isset($node->roster_sync_config['label_bold']) ? (bool)$node->roster_sync_config['label_bold'] : true;
                        $valueColor = $node->roster_sync_config['value_color'] ?? null;
                        $valueBold = isset($node->roster_sync_config['value_bold']) ? (bool)$node->roster_sync_config['value_bold'] : true;
                        
                        $dynamicSlots[] = [
                            'id' => 'auto_' . $row->id,
                            'roster_content_id' => $row->id,
                            'label' => $row->content[$keyCol] ?? '',
                            'value' => $row->content[$valueCol] ?? '',
                            'label_color' => $labelColor,
                            'label_bold' => $labelBold,
                            'value_color' => $valueColor,
                            'value_bold' => $valueBold,
                            'roster_content' => [
                                'id' => $row->id,
                                'section_id' => $row->section_id,
                                'content' => $row->content,
                                'color' => $row->color,
                            ]
                        ];
                    }
                    $node->slots = $dynamicSlots;
                } else {
                    $slots = $node->slots ?? [];
                    $resolvedSlots = [];
                    foreach ($slots as $slot) {
                        if (!empty($slot['roster_content_id']) && isset($rosterContents[$slot['roster_content_id']])) {
                            $rc = $rosterContents[$slot['roster_content_id']];
                            $slot['roster_content'] = [
                                'id' => $rc->id,
                                'section_id' => $rc->section_id,
                                'content' => $rc->content,
                                'color' => $rc->color,
                            ];
                        }
                        $resolvedSlots[] = $slot;
                    }
                    $node->slots = $resolvedSlots;
                }

                $node->children = $node->children()->get()->map(function ($child) use (&$resolveNode) {
                    return $resolveNode($child);
                });
                return $node;
            };

            $resolvedRootNodes = $rootNodes->map(function ($node) use (&$resolveNode) {
                return $resolveNode($node);
            });

            $hierarchy->nodes_tree = $resolvedRootNodes;

            // Compute user permissions
            $canModify = User::hasHierarchyPermission($user, $hierarchy, 'modify_hierarchy');
            $hierarchy->user_permissions = [
                'view_hierarchy' => User::hasHierarchyPermission($user, $hierarchy, 'view_hierarchy'),
                'modify_hierarchy' => $canModify,
                'edit_nodes' => User::hasHierarchyPermission($user, $hierarchy, 'edit_nodes'),
                'manage_nodes' => User::hasHierarchyPermission($user, $hierarchy, 'manage_nodes'),
            ];

            return $hierarchy;
        });

        $this->audit('hierarchy.list', "Viewed hierarchies list for faction {$faction->name}");

        return response()->json($resolvedHierarchies->values());
    }

    public function store(Request $request, $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        
        if (!User::hasFactionPermission(Auth::user(), $faction, 'create_hierarchy')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'color' => ['required', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'roster_id' => 'nullable|exists:rosters,id',
        ]);

        $maxOrder = $faction->hierarchies()->max('order') ?? -1;

        $hierarchy = $faction->hierarchies()->create([
            ...$validated,
            'order' => $maxOrder + 1,
            'created_by' => Auth::id(),
        ]);

        // Automatically create a root node
        $hierarchy->nodes()->create([
            'title' => 'Office of the Director',
            'color' => $hierarchy->color,
            'order' => 0,
            'slots' => [
                [
                    'id' => uniqid('slot_'),
                    'roster_content_id' => null,
                    'label' => 'Director',
                    'value' => 'VACANT',
                ]
            ]
        ]);

        $this->audit('hierarchy.create', "Created hierarchy '{$hierarchy->name}' for faction '{$faction->name}'", null, $hierarchy, null, $hierarchy->getAttributes());

        return response()->json($hierarchy, 201);
    }

    public function update(Request $request, Hierarchy $hierarchy)
    {
        $user = Auth::user();
        $canModify = User::hasHierarchyPermission($user, $hierarchy, 'modify_hierarchy');

        if (!$canModify) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'color' => ['sometimes', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'roster_id' => 'nullable|exists:rosters,id',
            'created_by' => 'nullable|integer|exists:users,id',
        ]);

        $oldValues = $hierarchy->getOriginal();
        $hierarchy->update($validated);

        $this->audit('hierarchy.update', "Updated hierarchy '{$hierarchy->name}'", null, $hierarchy, $oldValues, $hierarchy->getDirty());

        return response()->json($hierarchy);
    }

    public function destroy(Hierarchy $hierarchy)
    {
        $user = Auth::user();
        if (!User::hasHierarchyPermission($user, $hierarchy, 'modify_hierarchy')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('hierarchy.delete', "Deleted hierarchy '{$hierarchy->name}'", null, $hierarchy, $hierarchy->getAttributes());

        $hierarchy->delete();

        return response()->json(['message' => 'Hierarchy deleted']);
    }

    public function reorder(Request $request, $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        
        if (!User::hasFactionPermission(Auth::user(), $faction, 'global_hierarchy_moderation')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'hierarchy_order' => 'required|array',
            'hierarchy_order.*' => 'required|integer|exists:hierarchies,id',
        ]);

        foreach ($validated['hierarchy_order'] as $index => $id) {
            $faction->hierarchies()->where('id', $id)->update(['order' => $index]);
        }

        $this->audit('hierarchy.reorder', "Reordered hierarchies for faction '{$faction->name}'");

        return response()->json(['message' => 'Hierarchies reordered']);
    }
}
