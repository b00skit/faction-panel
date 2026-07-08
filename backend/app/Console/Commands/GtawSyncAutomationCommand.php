<?php

namespace App\Console\Commands;

use App\Models\GtawSyncAutomation;
use App\Models\GtawSyncLog;
use App\Services\GtawSyncService;
use Illuminate\Console\Command;

class GtawSyncAutomationCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'gtaw:sync-automation';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Runs scheduled user-bound GTA:W faction syncs';

    protected GtawSyncService $gtawSyncService;

    /**
     * Create a new command instance.
     */
    public function __construct(GtawSyncService $gtawSyncService)
    {
        parent::__construct();
        $this->gtawSyncService = $gtawSyncService;
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting scheduled GTA:W sync automation...');

        $automations = GtawSyncAutomation::where('enabled', true)
            ->where(function ($query) {
                $query->whereNull('next_run_at')
                    ->orWhere('next_run_at', '<=', now());
            })
            ->get();

        if ($automations->isEmpty()) {
            $this->info('No automations due for execution.');

            return 0;
        }

        foreach ($automations as $automation) {
            $faction = $automation->faction;
            if (! $faction) {
                continue;
            }

            $this->info("Processing automation for Faction: {$faction->name} (ID: {$faction->id})...");

            $leader = $faction->leader;
            if (! $leader) {
                $this->error("Faction leader not found for Faction: {$faction->name}.");
                $this->logFailure($faction->id, 'Faction leader not found.');
                $automation->update([
                    'next_run_at' => $automation->calculateNextRunAt(),
                    'last_run_at' => now(),
                ]);

                continue;
            }

            if (! $leader->gtaw_access_token) {
                $this->error("Faction leader {$leader->name} has not linked their GTA:W account.");
                $this->logFailure($faction->id, 'Faction leader has not linked their GTA:W account.', $leader->id);
                $automation->update([
                    'next_run_at' => $automation->calculateNextRunAt(),
                    'last_run_at' => now(),
                ]);

                continue;
            }

            try {
                $this->gtawSyncService->sync($faction, $leader, 'automated');
                $this->info("Successfully synchronized Faction: {$faction->name} using leader {$leader->name}'s token.");
            } catch (\Throwable $e) {
                $this->error("Failed to synchronize Faction: {$faction->name}. Error: ".$e->getMessage());
            } finally {
                $automation->update([
                    'next_run_at' => $automation->calculateNextRunAt(),
                    'last_run_at' => now(),
                ]);
            }
        }

        $this->info('Scheduled GTA:W sync automation completed.');

        return 0;
    }

    protected function logFailure(int $factionId, string $errorMessage, ?int $userId = null)
    {
        GtawSyncLog::create([
            'faction_id' => $factionId,
            'trigger_type' => 'automated',
            'user_id' => $userId,
            'status' => 'failed',
            'error' => $errorMessage,
            'started_at' => now(),
            'completed_at' => now(),
        ]);
    }
}
