<?php

namespace App\Http\Controllers;

use App\Models\Faction;
use App\Models\StatisticsModel;
use App\Models\User;
use App\Services\StatisticsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class StatisticsController extends Controller
{
    protected $statisticsService;

    public function __construct(StatisticsService $statisticsService)
    {
        $this->statisticsService = $statisticsService;
    }

    public function index($shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::user();

        $this->audit('statistics_model.index', "Viewed statistics models for faction '{$faction->name}'", null, $faction);

        $canViewAll = User::hasFactionPermission($user, $faction, 'view_all_statistics_models');
        $isGlobalMod = User::hasFactionPermission($user, $faction, 'global_statistics_moderation');

        $models = $faction->statisticsModels()
            ->with(['creator'])
            ->withCount('widgets')
            ->get();

        $filteredModels = $models->filter(function ($model) use ($user, $canViewAll, $isGlobalMod) {
            return $canViewAll || $isGlobalMod || User::hasStatisticsPermission($user, $model, 'view_statistics');
        });

        $filteredModels->each(function ($model) use ($user, $isGlobalMod) {
            $this->appendPermissions($model, $user, $isGlobalMod);
        });

        return response()->json($filteredModels->values());
    }

    private function appendPermissions(StatisticsModel $model, $user, $isGlobalMod)
    {
        $model->user_permissions = [
            'view_statistics' => $isGlobalMod || User::hasStatisticsPermission($user, $model, 'view_statistics'),
            'modify_statistics' => $isGlobalMod || User::hasStatisticsPermission($user, $model, 'modify_statistics'),
            'delete_statistics' => $isGlobalMod || User::hasStatisticsPermission($user, $model, 'delete_statistics'),
        ];
    }

    public function store(Request $request, $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::user();

        if (! User::hasFactionPermission($user, $faction, 'create_statistics_model')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        $model = $faction->statisticsModels()->create([
            ...$validated,
            'created_by' => Auth::id(),
        ]);

        $this->audit('statistics_model.create', "Created statistics model '{$model->name}' for faction '{$faction->name}'", null, $model, null, $model->getAttributes());

        $isGlobalMod = User::hasFactionPermission($user, $faction, 'global_statistics_moderation');
        $this->appendPermissions($model, $user, $isGlobalMod);

        return response()->json($model->load('creator'), 201);
    }

    public function show(StatisticsModel $model)
    {
        $user = Auth::user();
        $faction = $model->faction;

        $canViewAll = User::hasFactionPermission($user, $faction, 'view_all_statistics_models');
        $isGlobalMod = User::hasFactionPermission($user, $faction, 'global_statistics_moderation');

        if (! $canViewAll && ! $isGlobalMod && ! User::hasStatisticsPermission($user, $model, 'view_statistics')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('statistics_model.view', "Viewed statistics model '{$model->name}'", null, $model);

        $model->load(['creator', 'widgets']);

        $this->appendPermissions($model, $user, $isGlobalMod);

        return response()->json($model);
    }

    public function update(Request $request, StatisticsModel $model)
    {
        $user = Auth::user();
        $faction = $model->faction;
        $isGlobalMod = User::hasFactionPermission($user, $faction, 'global_statistics_moderation');

        if (! $isGlobalMod && ! User::hasStatisticsPermission($user, $model, 'modify_statistics')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'created_by' => 'nullable|integer|exists:users,id',
        ]);

        $oldValues = $model->getOriginal();
        $model->update($validated);

        $this->audit('statistics_model.update', "Updated statistics model '{$model->name}'", null, $model, $oldValues, $model->getDirty());

        $this->appendPermissions($model, $user, $isGlobalMod);

        return response()->json($model->load('creator'));
    }

    public function destroy(StatisticsModel $model)
    {
        $user = Auth::user();
        $faction = $model->faction;

        if (! User::hasFactionPermission($user, $faction, 'global_statistics_moderation') &&
            ! User::hasStatisticsPermission($user, $model, 'delete_statistics')
        ) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('statistics_model.delete', "Deleted statistics model '{$model->name}'", null, $model, $model->getAttributes());
        $model->delete();

        return response()->json(['message' => 'Statistics model deleted']);
    }

    public function recalculate(StatisticsModel $model)
    {
        $user = Auth::user();
        $faction = $model->faction;
        $isGlobalMod = User::hasFactionPermission($user, $faction, 'global_statistics_moderation');

        if (! $user->is_superadmin &&
            $faction->faction_leader !== $user->id &&
            ! $isGlobalMod &&
            ! User::hasStatisticsPermission($user, $model, 'view_statistics')
        ) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('statistics_model.recalculate', "Recalculated widgets for statistics model '{$model->name}'", null, $model);

        $widgets = $model->widgets;
        foreach ($widgets as $widget) {
            $this->statisticsService->calculate($widget, true);
        }

        $this->appendPermissions($model, $user, $isGlobalMod);

        return response()->json($model->load(['creator', 'widgets']));
    }
}
