<?php

namespace App\Http\Controllers;

use App\Models\Faction;
use App\Models\GtawSyncAutomation;
use App\Models\GtawSyncLog;
use App\Services\GtawService;
use App\Services\GtawSyncService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class IntegrationController extends Controller
{
    protected GtawService $gtawService;

    protected GtawSyncService $gtawSyncService;

    public function __construct(GtawService $gtawService, GtawSyncService $gtawSyncService)
    {
        $this->gtawService = $gtawService;
        $this->gtawSyncService = $gtawSyncService;
    }

    public function getAvailableFactions(string $shortname)
    {
        $user = Auth::user();
        if (! $user->gtaw_access_token) {
            return response()->json(['message' => 'User not linked with GTA:W'], 400);
        }

        $res = $this->gtawService->getFactions($user->gtaw_access_token);
        if (! $res || ! isset($res['data'])) {
            return response()->json(['message' => 'Failed to fetch factions from GTA:W or invalid response'], 500);
        }

        $factions = $res['data'];
        $available = [];

        foreach ($factions as $f) {
            $rank = $f['faction_rank'] ?? 0;
            if ($rank >= 15) {
                $available[] = [
                    'id' => $f['faction'],
                    'name' => $f['faction_name'],
                    'rank' => $rank,
                    'rank_name' => $f['faction_rank_name'] ?? '',
                ];
            }
        }

        $faction = Faction::where('shortname', $shortname)->first();
        $this->audit('integration.gtaw.available_factions', 'Fetched available GTA:W factions for integration'.($faction ? " on faction '{$faction->name}'" : ''), null, $faction);

        return response()->json($available);
    }

    public function setupGtaw(Request $request, string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();

        if (! Auth::user()->hasPermission('sync_gtaw', $faction->id)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'gtaw_faction_id' => 'required|integer',
        ]);

        if ($faction->gtaw_faction_id) {
            return response()->json(['message' => 'Integration already exists'], 400);
        }

        $oldValues = $faction->getOriginal();

        return DB::transaction(function () use ($request, $faction, $oldValues) {
            $faction->update([
                'gtaw_faction_id' => $request->gtaw_faction_id,
            ]);

            $dbs = $this->gtawSyncService->ensureGtawDatabases($faction);

            $this->audit('integration.gtaw.setup', "Set up GTA:W integration for faction '{$faction->name}' with GTA:W faction ID {$request->gtaw_faction_id}", null, $faction, $oldValues, $faction->getDirty());

            return response()->json([
                'message' => 'Integration setup successful',
                'databases' => [
                    'characters' => $dbs['CHARS'],
                    'history' => $dbs['CHIST'],
                    'name_changes' => $dbs['CNAME'],
                    'activity' => $dbs['ACTIVITY'],
                    'vehicles' => $dbs['VEHICLES'] ?? null,
                    'vehicle_history' => $dbs['VEHIST'] ?? null,
                ],
            ]);
        });
    }

    public function syncGtaw(Request $request, string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();

        if (! Auth::user()->hasPermission('sync_gtaw', $faction->id)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! $faction->gtaw_faction_id) {
            return response()->json(['message' => 'Integration not setup'], 400);
        }

        $user = Auth::user();
        if (! $user->gtaw_access_token) {
            return response()->json(['message' => 'User not linked with GTA:W'], 400);
        }

        try {
            $syncResults = $this->gtawSyncService->sync($faction, $user, 'manual');

            return response()->json([
                'message' => 'Synchronization complete',
                'results' => $syncResults,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Synchronization failed: '.$e->getMessage(),
            ], 500);
        }
    }

    public function pruneGtaw(Request $request, string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();

        if (! Auth::user()->hasPermission('sync_gtaw', $faction->id)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $charDb = $this->gtawSyncService->findGtawDatabase($faction, 'CHARS');
        if ($charDb) {
            $charDb->entries()->delete();
        }

        $vehDb = $this->gtawSyncService->findGtawDatabase($faction, 'VEHICLES');
        if ($vehDb) {
            $vehDb->entries()->delete();
        }

        $this->audit('integration.gtaw.prune', "Pruned synchronized GTA:W database entries for faction '{$faction->name}'", null, $faction);

        return response()->json(['message' => 'All synchronized data pruned']);
    }

    public function getAutomationSettings(string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();

        if (Auth::id() !== $faction->faction_leader && ! Auth::user()->is_superadmin) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $automation = GtawSyncAutomation::where('faction_id', $faction->id)->first();
        $logs = GtawSyncLog::where('faction_id', $faction->id)
            ->with('user:id,username,gtaw_username')
            ->orderBy('started_at', 'desc')
            ->limit(20)
            ->get();

        return response()->json([
            'automation' => $automation,
            'logs' => $logs,
        ]);
    }

    public function saveAutomationSettings(Request $request, string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();

        if (Auth::id() !== $faction->faction_leader && ! Auth::user()->is_superadmin) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'enabled' => 'required|boolean',
            'frequency' => 'required|string|in:daily,every_2_days,every_3_days,weekly',
            'time_of_day' => 'required|string|regex:/^\d{2}:\d{2}$/',
        ]);

        $automation = GtawSyncAutomation::updateOrCreate(
            ['faction_id' => $faction->id],
            [
                'enabled' => $request->enabled,
                'frequency' => $request->frequency,
                'time_of_day' => $request->time_of_day,
                'created_by' => Auth::id(),
            ]
        );

        if ($automation->enabled) {
            $automation->next_run_at = $automation->calculateNextRunAt();
        } else {
            $automation->next_run_at = null;
        }
        $automation->save();

        // Audit the change
        $this->audit(
            'integration.gtaw.automation_updated',
            'Updated GTA:W sync automation settings: '.($automation->enabled ? 'Enabled' : 'Disabled').", frequency: {$automation->frequency}, time: {$automation->time_of_day}",
            null,
            $faction
        );

        $logs = GtawSyncLog::where('faction_id', $faction->id)
            ->with('user:id,username,gtaw_username')
            ->orderBy('started_at', 'desc')
            ->limit(20)
            ->get();

        return response()->json([
            'automation' => $automation,
            'logs' => $logs,
        ]);
    }
}
