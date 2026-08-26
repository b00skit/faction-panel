<?php

namespace App\Events;

use App\Models\Roster;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RosterUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $roster;

    /**
     * Create a new event instance.
     */
    public function __construct(Roster $roster)
    {
        $this->roster = $roster;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PresenceChannel("faction.{$this->roster->faction_id}.updates"),
            new PresenceChannel("faction.{$this->roster->faction_id}.roster.{$this->roster->id}"),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'roster.updated';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'roster_id' => $this->roster->id,
            'name' => $this->roster->name,
        ];
    }
}
