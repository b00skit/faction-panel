<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class KanbanBoardUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $factionId;
    public $projectId;
    public $cardId;
    public $action; // e.g. 'project_updated', 'card_moved', 'card_updated'

    /**
     * Create a new event instance.
     */
    public function __construct(int $factionId, int $projectId, ?int $cardId = null, string $action = 'board_updated')
    {
        $this->factionId = $factionId;
        $this->projectId = $projectId;
        $this->cardId = $cardId;
        $this->action = $action;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("faction.{$this->factionId}.kanban"),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'kanban.updated';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'faction_id' => $this->factionId,
            'project_id' => $this->projectId,
            'card_id' => $this->cardId,
            'action' => $this->action,
        ];
    }
}
