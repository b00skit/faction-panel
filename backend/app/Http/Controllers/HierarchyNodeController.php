<?php

namespace App\Http\Controllers;

use App\Events\HierarchyUpdated;
use App\Models\Faction;
use App\Models\Hierarchy;
use App\Models\HierarchyNode;
use App\Models\RosterContent;
use App\Models\RosterRevision;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class HierarchyNodeController extends Controller
{

    public function store(Request $request, Hierarchy $hierarchy)
    {
        $user = Auth::user();
        if (!User::hasHierarchyPermission($user, $hierarchy, 'manage_nodes')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'parent_id' => 'nullable|exists:hierarchy_nodes,id',
            'title' => 'nullable|string|max:255',
            'color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'card_style' => 'sometimes|string|in:standard,spotlight,highlighted',
            'image_url' => 'nullable|string|max:2048',
            'icon' => 'nullable|string|max:50',
            'slots' => 'nullable|array',
            'slots.*.id' => 'required|string',
            'slots.*.roster_content_id' => 'nullable|integer|exists:roster_contents,id',
            'slots.*.label' => 'nullable|string|max:255',
            'slots.*.value' => 'nullable|string|max:255',
            'slots.*.color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'slots.*.label_color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'slots.*.label_bold' => 'nullable|boolean',
            'slots.*.value_color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'slots.*.value_bold' => 'nullable|boolean',
            'roster_sync_config' => 'nullable|array',
            'roster_sync_config.enabled' => 'nullable|boolean',
            'roster_sync_config.section_id' => 'nullable|integer|exists:roster_sections,id',
            'roster_sync_config.row_start' => 'nullable|integer|min:1',
            'roster_sync_config.row_end' => 'nullable|integer|min:1',
            'roster_sync_config.key_col' => 'nullable|string|max:255',
            'roster_sync_config.value_col' => 'nullable|string|max:255',
            'roster_sync_config.label_color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'roster_sync_config.label_bold' => 'nullable|boolean',
            'roster_sync_config.value_color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'roster_sync_config.value_bold' => 'nullable|boolean',
        ]);

        $maxOrder = $hierarchy->nodes()->where('parent_id', $validated['parent_id'] ?? null)->max('order') ?? -1;

        $node = $hierarchy->nodes()->create([
            'parent_id' => $validated['parent_id'] ?? null,
            'title' => $validated['title'] ?? 'New Division',
            'color' => $validated['color'] ?? $hierarchy->color,
            'card_style' => $validated['card_style'] ?? 'standard',
            'image_url' => $validated['image_url'] ?? null,
            'icon' => $validated['icon'] ?? null,
            'slots' => $validated['slots'] ?? [],
            'roster_sync_config' => $validated['roster_sync_config'] ?? null,
            'order' => $maxOrder + 1,
        ]);

        $this->audit('hierarchy_node.create', "Created node '{$node->title}' in hierarchy '{$hierarchy->name}'", $hierarchy->faction_id, $node, null, $node->getAttributes());

        return response()->json($node, 201);
    }

    public function update(Request $request, HierarchyNode $node)
    {
        $hierarchy = $node->hierarchy;
        $user = Auth::user();

        // Determine if they can edit nodes or manage node structure
        $canEdit = User::hasHierarchyPermission($user, $hierarchy, 'edit_nodes');
        $canManage = User::hasHierarchyPermission($user, $hierarchy, 'manage_nodes');

        if (!$canEdit && !$canManage) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'parent_id' => 'sometimes|nullable|exists:hierarchy_nodes,id',
            'title' => 'sometimes|nullable|string|max:255',
            'color' => ['sometimes', 'nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'card_style' => 'sometimes|string|in:standard,spotlight,highlighted',
            'image_url' => 'sometimes|nullable|string|max:2048',
            'icon' => 'sometimes|nullable|string|max:50',
            'slots' => 'sometimes|nullable|array',
            'slots.*.id' => 'required|string',
            'slots.*.roster_content_id' => 'nullable|integer|exists:roster_contents,id',
            'slots.*.label' => 'nullable|string|max:255',
            'slots.*.value' => 'nullable|string|max:255',
            'slots.*.color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'slots.*.label_color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'slots.*.label_bold' => 'nullable|boolean',
            'slots.*.value_color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'slots.*.value_bold' => 'nullable|boolean',
            'roster_sync_config' => 'sometimes|nullable|array',
            'roster_sync_config.enabled' => 'nullable|boolean',
            'roster_sync_config.section_id' => 'nullable|integer|exists:roster_sections,id',
            'roster_sync_config.row_start' => 'nullable|integer|min:1',
            'roster_sync_config.row_end' => 'nullable|integer|min:1',
            'roster_sync_config.key_col' => 'sometimes|nullable|string|max:255',
            'roster_sync_config.value_col' => 'sometimes|nullable|string|max:255',
            'roster_sync_config.label_color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'roster_sync_config.label_bold' => 'nullable|boolean',
            'roster_sync_config.value_color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'roster_sync_config.value_bold' => 'nullable|boolean',
            'order' => 'sometimes|integer',
        ]);

        // If trying to change structure (parent_id, order, or modifying slots configuration) but only has edit_nodes, block it.
        if (!$canManage && (isset($validated['parent_id']) || isset($validated['order']))) {
            return response()->json(['message' => 'Forbidden: Structure updates require Manage Nodes permission'], 403);
        }

        $oldValues = $node->getOriginal();

        // Handle Two-way Roster updates
        if (isset($validated['slots']) && $hierarchy->roster_id) {
            $nameColId = 'name';
            $rankColId = 'rank';
            
            foreach ($validated['slots'] as &$slot) {
                if (!empty($slot['roster_content_id'])) {
                    $content = RosterContent::with('section.roster')->find($slot['roster_content_id']);
                    if ($content) {
                        $oldContent = $content->content ?? [];
                        $newContent = $oldContent;

                        // Identify column keys from Roster columns if possible, else defaults
                        $roster = $content->section->roster;
                        if ($roster && $roster->columns) {
                            $columns = $roster->columns;
                            $nameCol = collect($columns)->first(fn($c) => ($c['id'] ?? '') === 'name' || str_contains(strtolower($c['name'] ?? ''), 'name'));
                            $rankCol = collect($columns)->first(fn($c) => ($c['id'] ?? '') === 'rank' || str_contains(strtolower($c['name'] ?? ''), 'rank') || str_contains(strtolower($c['name'] ?? ''), 'role'));
                            if ($nameCol) $nameColId = $nameCol['id'];
                            if ($rankCol) $rankColId = $rankCol['id'];
                        }

                        // Check if we are updating values or if we should pull them (e.g. if the user didn't modify label/value)
                        $wasDirty = false;
                        if (array_key_exists('label', $slot) && $slot['label'] !== ($oldContent[$rankColId] ?? null)) {
                            $newContent[$rankColId] = $slot['label'];
                            $wasDirty = true;
                        }
                        if (array_key_exists('value', $slot) && $slot['value'] !== ($oldContent[$nameColId] ?? null)) {
                            $newContent[$nameColId] = $slot['value'];
                            $wasDirty = true;
                        }

                        if ($wasDirty) {
                            $content->content = $newContent;
                            $content->save();

                            // Log Roster Revision
                            RosterRevision::logRevision($roster->id, "Updated via Hierarchy diagram '{$hierarchy->name}' (Card: {$node->title})", Auth::id());
                        } else {
                            // If the values weren't updated by user, pull current values from roster to synchronize
                            $slot['label'] = $oldContent[$rankColId] ?? $slot['label'];
                            $slot['value'] = $oldContent[$nameColId] ?? $slot['value'];
                        }
                    }
                }
            }
        }

        $node->update($validated);

        $this->audit('hierarchy_node.update', "Updated node '{$node->title}' in hierarchy '{$hierarchy->name}'", $hierarchy->faction_id, $node, $oldValues, $node->getDirty());

        $node->refresh();

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
            // Eager load resolved slot contents before returning
            $slots = $node->slots ?? [];
            $resolvedSlots = [];
            foreach ($slots as $slot) {
                if (!empty($slot['roster_content_id'])) {
                    $rc = RosterContent::find($slot['roster_content_id']);
                    if ($rc) {
                        $slot['roster_content'] = [
                            'id' => $rc->id,
                            'section_id' => $rc->section_id,
                            'content' => $rc->content,
                            'color' => $rc->color,
                        ];
                    }
                }
                $resolvedSlots[] = $slot;
            }
            $node->slots = $resolvedSlots;
        }

        return response()->json($node);
    }

    public function destroy(HierarchyNode $node)
    {
        $hierarchy = $node->hierarchy;
        $user = Auth::user();
        if (!User::hasHierarchyPermission($user, $hierarchy, 'manage_nodes')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('hierarchy_node.delete', "Deleted node '{$node->title}' in hierarchy '{$hierarchy->name}'", $hierarchy->faction_id, $node, $node->getAttributes());

        $node->delete();

        return response()->json(['message' => 'Node deleted']);
    }

    public function reorder(Request $request, Hierarchy $hierarchy)
    {
        $user = Auth::user();
        if (!User::hasHierarchyPermission($user, $hierarchy, 'manage_nodes')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'parent_id' => 'nullable|exists:hierarchy_nodes,id',
            'node_order' => 'required|array',
            'node_order.*' => 'required|integer|exists:hierarchy_nodes,id',
        ]);

        foreach ($validated['node_order'] as $index => $id) {
            $hierarchy->nodes()
                ->where('id', $id)
                ->update([
                    'parent_id' => $validated['parent_id'],
                    'order' => $index
                ]);
        }

        Faction::invalidateDiagramsCache($hierarchy->faction_id);
        HierarchyUpdated::dispatch($hierarchy->faction_id, $hierarchy->id);

        $this->audit('hierarchy_node.reorder', "Reordered nodes in hierarchy '{$hierarchy->name}'", $hierarchy->faction_id);

        return response()->json(['message' => 'Nodes reordered']);
    }
}
