<?php

namespace App\Events;

use App\Models\RosterContent;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RosterRowAdded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $content;

    /**
     * Create a new event instance.
     */
    public function __construct(RosterContent $content)
    {
        $this->content = $content;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        $roster = $this->content->section->roster;

        return [
            new PrivateChannel("faction.{$roster->faction_id}.roster.{$roster->id}"),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'roster.row_added';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->content->id,
            'section_id' => $this->content->section_id,
            'content' => $this->content->content,
            'order' => $this->content->order,
            'editing_by' => $this->content->editing_by,
        ];
    }
}
