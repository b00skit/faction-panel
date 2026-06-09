<?php

namespace App\Http\Controllers;

use App\Models\StatisticsModel;
use App\Models\StatisticsWidget;
use App\Models\User;
use App\Services\StatisticsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class StatisticsWidgetController extends Controller
{
    protected $statisticsService;

    public function __construct(StatisticsService $statisticsService)
    {
        $this->statisticsService = $statisticsService;
    }

    public function store(Request $request, StatisticsModel $model)
    {
        $faction = $model->faction;
        if (! User::hasFactionPermission(Auth::user(), $faction, 'global_statistics_moderation') &&
            $model->created_by !== Auth::id()
        ) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => ['required', Rule::in(['pie', 'bar', 'line', 'table', 'stat', 'radar'])],
            'configuration' => 'required|array',
            'width' => 'integer|min:1|max:12',
            'order' => 'integer',
        ]);

        $widget = $model->widgets()->create($validated);

        // Initial calculation (integrated caching)
        $this->statisticsService->calculate($widget, true);

        $this->audit('statistics_widget.create', "Created statistics widget '{$widget->name}' on model '{$model->name}'", $faction->id, $widget, null, $widget->getAttributes());

        return response()->json($widget, 201);
    }

    public function update(Request $request, StatisticsWidget $widget)
    {
        $model = $widget->statisticsModel;
        $faction = $model->faction;

        if (! User::hasFactionPermission(Auth::user(), $faction, 'global_statistics_moderation') &&
            $model->created_by !== Auth::id()
        ) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'type' => ['sometimes', Rule::in(['pie', 'bar', 'line', 'table', 'stat', 'radar'])],
            'configuration' => 'sometimes|array',
            'width' => 'sometimes|integer|min:1|max:12',
            'order' => 'sometimes|integer',
        ]);

        $oldValues = $widget->getOriginal();
        $widget->update($validated);

        // Recalculate (integrated caching)
        $this->statisticsService->calculate($widget, true);

        $this->audit('statistics_widget.update', "Updated statistics widget '{$widget->name}'", $faction->id, $widget, $oldValues, $widget->getDirty());

        return response()->json($widget->fresh());
    }

    public function destroy(StatisticsWidget $widget)
    {
        $model = $widget->statisticsModel;
        $faction = $model->faction;

        if (! User::hasFactionPermission(Auth::user(), $faction, 'global_statistics_moderation') &&
            $model->created_by !== Auth::id()
        ) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('statistics_widget.delete', "Deleted statistics widget '{$widget->name}'", $faction->id, $widget, $widget->getAttributes());
        $widget->delete();

        return response()->json(['message' => 'Widget deleted']);
    }

    public function recalculate(StatisticsWidget $widget)
    {
        $model = $widget->statisticsModel;
        $faction = $model->faction;
        $user = Auth::user();

        if (! $user->is_superadmin &&
            $faction->faction_leader !== $user->id &&
            ! User::hasFactionPermission($user, $faction, 'global_statistics_moderation') &&
            ! User::hasStatisticsPermission($user, $model, 'view_statistics')
        ) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('statistics_widget.recalculate', "Recalculated statistics widget '{$widget->name}'", $faction->id, $widget);

        $this->statisticsService->calculate($widget, true);

        return response()->json($widget->fresh());
    }

    public function reorder(Request $request, StatisticsModel $model)
    {
        $faction = $model->faction;
        if (! User::hasFactionPermission(Auth::user(), $faction, 'global_statistics_moderation') &&
            $model->created_by !== Auth::id()
        ) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'widget_ids' => 'required|array',
            'widget_ids.*' => 'exists:statistics_widgets,id',
        ]);

        foreach ($validated['widget_ids'] as $index => $id) {
            StatisticsWidget::where('id', $id)->where('statistics_model_id', $model->id)->update(['order' => $index]);
        }

        $this->audit('statistics_widget.reorder', "Reordered widgets on statistics model '{$model->name}'", $faction->id, $model, null, ['widget_ids' => $validated['widget_ids']]);

        return response()->json(['message' => 'Order updated']);
    }
}
