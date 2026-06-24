<?php

namespace App\Events;

use App\Models\RosterSection;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RosterRowsReordered implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $sectionId;

    public $contentIds;

    public $rosterId;

    public $factionId;

    /**
     * Create a new event instance.
     */
    public function __construct(RosterSection $section, array $contentIds)
    {
        $this->sectionId = $section->id;
        $this->contentIds = $contentIds;
        $this->rosterId = $section->roster_id;
        $this->factionId = $section->roster->faction_id;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("faction.{$this->factionId}.roster.{$this->rosterId}"),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'roster.rows_reordered';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'section_id' => $this->sectionId,
            'content_ids' => $this->contentIds,
        ];
    }
}
