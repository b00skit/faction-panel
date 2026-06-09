<?php

namespace App\Jobs;

use App\Models\AuditLog;
use App\Models\Faction;
use App\Models\User;
use App\Services\RosterSyncService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SyncRosterData implements ShouldQueue
{
    use InteractsWithQueue, Queueable, SerializesModels;

    public $faction;

    public $user;

    /**
     * Create a new job instance.
     */
    public function __construct(Faction $faction, ?User $user = null)
    {
        $this->faction = $faction;
        $this->user = $user;
    }

    /**
     * Execute the job.
     */
    public function handle(RosterSyncService $syncService): void
    {
        $modified = $syncService->syncFaction($this->faction);

        // Audit log
        AuditLog::create([
            'event' => 'faction.sync_roster_data',
            'description' => "Queued synchronization of roster data for faction '{$this->faction->name}' completed — {$modified} row(s) updated",
            'faction_id' => $this->faction->id,
            'user_id' => $this->user ? $this->user->id : null,
            'new_values' => [
                'modified' => $modified,
                'source' => 'queue',
            ],
        ]);
    }
}
