<?php

namespace App\Http\Controllers;

use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class FactionRecordController extends Controller
{
    public function index(string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();

        $databases = FactionRecordDatabase::where('faction_id', $faction->id)
            ->with('creator:id,username')
            ->get();

        // Filter by 'view_database' permission
        $user = Auth::user();
        $databases = $databases->filter(function ($database) use ($user) {
            return User::hasRecordPermission($user, $database, 'view_database');
        })->values();

        $this->audit('record_database.index', "Viewed list of record databases for faction '{$faction->name}'", $faction->id);

        return response()->json($databases);
    }

    public function store(Request $request, string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();

        if (! User::hasFactionPermission(Auth::user(), $faction, 'create_faction_record_database')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'allow_details_view' => 'boolean',
            'data_overview_display' => 'required|string',
            'data_entry_display' => 'required|string',
            'record_shortcode' => 'nullable|string|max:10',
            'database_structure' => 'present|array',
            'detail_customization' => 'nullable|array',
            'permissions' => 'nullable|array',
        ]);

        $database = $faction->recordDatabases()->create([
            ...$validated,
            'is_api_database' => false,
            'created_by' => Auth::id(),
        ]);

        $this->audit('record_database.create', "Created record database '{$database->name}'", $faction->id, $database);

        return response()->json($database, 201);
    }

    public function show(string $shortname, FactionRecordDatabase $database)
    {
        if (! User::hasRecordPermission(Auth::user(), $database, 'view_database')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('record_database.show', "Viewed record database '{$database->name}'", $database->faction_id, $database);

        return response()->json($database->load('creator:id,username'));
    }

    public function update(Request $request, string $shortname, FactionRecordDatabase $database)
    {
        if (! User::hasFactionPermission(Auth::user(), $database->faction, 'global_faction_record_moderation') && $database->created_by !== Auth::id()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'allow_details_view' => 'sometimes|boolean',
            'data_overview_display' => 'sometimes|required|string',
            'data_entry_display' => 'sometimes|required|string',
            'record_shortcode' => 'nullable|string|max:10',
            'database_structure' => 'sometimes|array',
            'detail_customization' => 'sometimes|nullable|array',
            'permissions' => 'nullable|array',
            'is_published' => 'sometimes|boolean',
            'created_by' => 'nullable|integer|exists:users,id',
        ]);

        if ($database->is_api_database && ! Auth::user()->is_superadmin) {
            return response()->json(['message' => 'Only superadmins can edit API-managed databases.'], 403);
        }

        $oldValues = $database->getOriginal();
        $database->update($validated);

        $this->audit('record_database.update', "Updated record database '{$database->name}'", $database->faction_id, $database, $oldValues, $database->getDirty());

        return response()->json($database);
    }

    public function destroy(string $shortname, FactionRecordDatabase $database)
    {
        if ($database->is_api_database && ! Auth::user()->is_superadmin) {
            return response()->json(['message' => 'Only superadmins can delete API-managed databases.'], 403);
        }

        if (! User::hasFactionPermission(Auth::user(), $database->faction, 'global_faction_record_moderation') && $database->created_by !== Auth::id()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('record_database.delete', "Deleted record database '{$database->name}'", $database->faction_id, $database, $database->getAttributes());

        $database->delete();

        return response()->json(null, 204);
    }
}
