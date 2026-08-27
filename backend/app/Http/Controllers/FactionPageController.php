<?php

namespace App\Http\Controllers;

use App\Models\Faction;
use App\Models\FactionPage;
use App\Models\FactionPagePermission;
use App\Models\FactionRecordDatabase;
use App\Models\FactionRecordEntry;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class FactionPageController extends Controller
{
    public function index(string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::user();

        if ($user && ! User::canAccessFaction($user, $faction)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $canModify = $user && User::hasFactionPermission($user, $faction, 'modify_faction_pages');
        $canView = $user && User::hasFactionPermission($user, $faction, 'view_faction_pages');

        if (! $canView && ! $canModify && ! ($user && ($user->is_superadmin || $faction->faction_leader === $user->id))) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $query = FactionPage::where('faction_id', $faction->id)->orderBy('sort_order', 'asc')->orderBy('created_at', 'asc');

        if (! $canModify) {
            $query->where('is_published', true);
        }

        $pages = $query->get()->filter(function ($page) use ($user) {
            return User::hasPagePermission($user, $page, 'view_page');
        })->values();

        $this->audit('faction_pages.index', "Viewed list of custom pages for faction '{$faction->name}'", $faction->id);

        return response()->json($pages);
    }

    public function store(Request $request, string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::user();

        if (! User::hasFactionPermission($user, $faction, 'create_faction_pages') && ! User::hasFactionPermission($user, $faction, 'modify_faction_pages')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => [
                'nullable',
                'string',
                'max:255',
                'regex:/^[a-z0-9\-_]+$/i',
                Rule::unique('faction_pages')->where('faction_id', $faction->id)->whereNull('deleted_at'),
            ],
            'icon' => 'nullable|string|max:100',
            'show_in_sidebar' => 'boolean',
            'content' => 'nullable|string',
            'sort_order' => 'integer',
            'is_published' => 'boolean',
        ]);

        $slug = ! empty($validated['slug']) ? Str::slug($validated['slug']) : Str::slug($validated['name']);

        // Ensure slug is unique per faction
        $originalSlug = $slug;
        $counter = 1;
        while (FactionPage::where('faction_id', $faction->id)->where('slug', $slug)->whereNull('deleted_at')->exists()) {
            $slug = "{$originalSlug}-{$counter}";
            $counter++;
        }

        $page = $faction->pages()->create([
            'name' => $validated['name'],
            'slug' => $slug,
            'icon' => $validated['icon'] ?? 'FileText',
            'show_in_sidebar' => $validated['show_in_sidebar'] ?? true,
            'content' => $validated['content'] ?? '',
            'sort_order' => $validated['sort_order'] ?? 0,
            'is_published' => $validated['is_published'] ?? true,
            'created_by' => Auth::id(),
            'updated_by' => Auth::id(),
        ]);

        $this->audit('faction_pages.create', "Created page '{$page->name}' ({$page->slug})", $faction->id, $page);

        return response()->json($page, 201);
    }

    public function show(string $shortname, string $identifier)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::user();

        $page = FactionPage::where('faction_id', $faction->id)
            ->where(function ($q) use ($identifier) {
                if (is_numeric($identifier)) {
                    $q->where('id', (int) $identifier)->orWhere('slug', $identifier);
                } else {
                    $q->where('slug', $identifier);
                }
            })
            ->firstOrFail();

        if (! User::hasPagePermission($user, $page, 'view_page')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('faction_pages.show', "Viewed page '{$page->name}'", $faction->id, $page);

        return response()->json($page);
    }

    public function update(Request $request, string $shortname, FactionPage $page)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::user();

        if ($page->faction_id !== $faction->id) {
            return response()->json(['message' => 'Not found'], 444);
        }

        if (! User::hasFactionPermission($user, $faction, 'modify_faction_pages')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'slug' => [
                'sometimes',
                'string',
                'max:255',
                'regex:/^[a-z0-9\-_]+$/i',
                Rule::unique('faction_pages')->where('faction_id', $faction->id)->ignore($page->id)->whereNull('deleted_at'),
            ],
            'icon' => 'sometimes|string|max:100',
            'show_in_sidebar' => 'sometimes|boolean',
            'content' => 'nullable|string',
            'sort_order' => 'sometimes|integer',
            'is_published' => 'sometimes|boolean',
        ]);

        if (isset($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['slug']);
        }

        $validated['updated_by'] = Auth::id();

        $oldValues = $page->getOriginal();
        $page->update($validated);

        $this->audit('faction_pages.update', "Updated page '{$page->name}'", $faction->id, $page, $oldValues, $page->getDirty());

        return response()->json($page);
    }

    public function destroy(string $shortname, FactionPage $page)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::user();

        if ($page->faction_id !== $faction->id) {
            return response()->json(['message' => 'Not found'], 444);
        }

        if (! User::hasFactionPermission($user, $faction, 'modify_faction_pages')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('faction_pages.delete', "Deleted page '{$page->name}'", $faction->id, $page);

        $page->delete();

        return response()->json(['message' => 'Page deleted successfully']);
    }

    public function reorder(Request $request, string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::user();

        if (! User::hasFactionPermission($user, $faction, 'modify_faction_pages')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'pages' => 'required|array',
            'pages.*.id' => 'required|integer|exists:faction_pages,id',
            'pages.*.sort_order' => 'required|integer',
        ]);

        foreach ($validated['pages'] as $item) {
            FactionPage::where('id', $item['id'])
                ->where('faction_id', $faction->id)
                ->update(['sort_order' => $item['sort_order']]);
        }

        $this->audit('faction_pages.reorder', 'Reordered faction pages', $faction->id);

        return response()->json(['message' => 'Pages reordered successfully']);
    }

    public function getPermissions(string $shortname, FactionPage $page)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::user();

        if ($page->faction_id !== $faction->id) {
            return response()->json(['message' => 'Not found'], 444);
        }

        if (! User::hasFactionPermission($user, $faction, 'modify_faction_pages')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $permissions = $page->permissions()->with(['role', 'group'])->get();

        return response()->json($permissions);
    }

    public function updatePermissions(Request $request, string $shortname, FactionPage $page)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::user();

        if ($page->faction_id !== $faction->id) {
            return response()->json(['message' => 'Not found'], 444);
        }

        if (! User::hasFactionPermission($user, $faction, 'modify_faction_pages')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'permissions' => 'present|array',
            'permissions.*.role_id' => 'nullable|integer|exists:roles,id',
            'permissions.*.group_id' => 'nullable|integer|exists:groups,id',
            'permissions.*.permissions' => 'required|array',
        ]);

        $page->permissions()->delete();

        foreach ($request->permissions as $perm) {
            $page->permissions()->create([
                'role_id' => $perm['role_id'] ?? null,
                'group_id' => $perm['group_id'] ?? null,
                'permissions' => $perm['permissions'],
            ]);
        }

        User::clearPermissionsCache();

        $this->audit('faction_pages.permissions', "Updated permissions for page '{$page->name}'", $faction->id, $page);

        return response()->json($page->permissions()->with(['role', 'group'])->get());
    }

    public function getContextData(string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::user();

        // 1. Fetch accessible record databases & entries
        $databases = FactionRecordDatabase::where('faction_id', $faction->id)->get();
        $accessibleDatabases = [];
        $recordsMap = [];

        foreach ($databases as $db) {
            if (User::hasRecordPermission($user, $db, 'view_database')) {
                $entries = FactionRecordEntry::where('database_id', $db->id)
                    ->where('is_active', true)
                    ->get()
                    ->map(function ($entry) {
                        return [
                            'id' => $entry->id,
                            'entry_data' => $entry->entry_data,
                            'created_at' => $entry->created_at ? $entry->created_at->toIso8601String() : null,
                            'created_by' => $entry->created_by,
                        ];
                    });

                $dbData = [
                    'id' => $db->id,
                    'name' => $db->name,
                    'description' => $db->description,
                    'record_shortcode' => $db->record_shortcode,
                    'structure' => $db->database_structure,
                    'entries_count' => $entries->count(),
                    'entries' => $entries,
                ];

                $accessibleDatabases[] = $dbData;
                $recordsMap[$db->name] = $entries;
                $slugifiedKey = Str::slug($db->name, '_');
                $recordsMap[$slugifiedKey] = $entries;

                if ($db->record_shortcode) {
                    $recordsMap[$db->record_shortcode] = $entries;
                }
            }
        }

        // 2. Fetch roles with member counts
        $roles = $faction->roles()->withCount('users')->orderBy('weight', 'desc')->get()->map(function ($r) {
            return [
                'id' => $r->id,
                'name' => $r->name,
                'weight' => $r->weight,
                'color' => $r->color,
                'type' => $r->type,
                'members_count' => $r->users_count,
            ];
        });

        // 3. Fetch groups with member counts
        $groups = $faction->groups()->withCount('members')->get()->map(function ($g) {
            return [
                'id' => $g->id,
                'name' => $g->name,
                'color' => $g->color,
                'description' => $g->description ?? '',
                'members_count' => $g->members_count,
            ];
        });

        // 4. Fetch rosters summary
        $rosters = $faction->rosters()->withCount('sections')->get()->map(function ($r) {
            return [
                'id' => $r->id,
                'name' => $r->name,
                'shortname' => $r->shortname,
                'is_sandbox' => (bool) $r->is_sandbox,
                'sections_count' => $r->sections_count,
            ];
        });

        // 5. User context
        $userRoles = $user ? $user->roles()->where('faction_id', $faction->id)->get()->map(fn ($r) => [
            'id' => $r->id,
            'name' => $r->name,
            'color' => $r->color,
            'weight' => $r->weight,
        ]) : [];

        $userGroups = $user ? $user->groups()->where('faction_id', $faction->id)->get()->map(fn ($g) => [
            'id' => $g->id,
            'name' => $g->name,
            'color' => $g->color,
            'is_leader' => (bool) $g->pivot->is_leader,
        ]) : [];

        $userData = $user ? [
            'id' => $user->id,
            'username' => $user->username,
            'display_name' => $user->display_name,
            'email' => $user->email,
            'gtaw_id' => $user->gtaw_id,
            'avatar_url' => $user->avatar_url,
            'created_at' => $user->created_at ? $user->created_at->toIso8601String() : null,
            'is_superadmin' => (bool) $user->is_superadmin,
            'is_faction_leader' => $faction->faction_leader === $user->id,
            'roles' => $userRoles,
            'groups' => $userGroups,
        ] : null;

        // 6. Faction context
        $factionData = [
            'id' => $faction->id,
            'name' => $faction->name,
            'shortname' => $faction->shortname,
            'description' => $faction->description ?? '',
            'color' => $faction->color,
            'created_at' => $faction->created_at ? $faction->created_at->toIso8601String() : null,
            'gtaw_faction_id' => $faction->gtaw_faction_id,
            'header_image_dark' => $faction->header_image_dark,
            'header_image_light' => $faction->header_image_light,
            'favicon' => $faction->favicon,
            'members_count' => $faction->users()->count(),
            'roles_count' => $roles->count(),
            'groups_count' => $groups->count(),
            'rosters_count' => $rosters->count(),
            'records_count' => count($accessibleDatabases),
        ];

        return response()->json([
            'faction' => $factionData,
            'user' => $userData,
            'roles' => $roles,
            'groups' => $groups,
            'rosters' => $rosters,
            'record_databases' => $accessibleDatabases,
            'records' => $recordsMap,
            'current_date' => now()->format('Y-m-d'),
            'current_time' => now()->format('H:i:s'),
            'current_timestamp' => now()->format('Y-m-d H:i:s'),
            'site' => [
                'name' => 'Antelope',
                'version' => '1.0.0',
            ],
        ]);
    }
}
