<?php

namespace App\Models;

use App\Events\RosterRowAdded;
use App\Events\RosterRowDeleted;
use App\Events\RosterRowUpdated;
use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class RosterContent extends Model
{
    use Auditable, SoftDeletes;

    protected static function booted()
    {
        static::created(function ($content) {
            $roster = $content->section?->roster;
            if ($roster) {
                Faction::invalidateRosterCache($roster->faction_id);
                Faction::invalidateDiagramsCache($roster->faction_id);
                RosterRowAdded::dispatch($content);
            }
        });

        static::updated(function ($content) {
            $roster = $content->section?->roster;
            if ($roster) {
                Faction::invalidateRosterCache($roster->faction_id);
                Faction::invalidateDiagramsCache($roster->faction_id);
                RosterRowUpdated::dispatch($content);
            }
        });

        static::deleted(function ($content) {
            $roster = $content->section?->roster;
            if ($roster) {
                Faction::invalidateRosterCache($roster->faction_id);
                Faction::invalidateDiagramsCache($roster->faction_id);
                RosterRowDeleted::dispatch($content->id, $roster->id, $roster->faction_id);
            }

            // Clean up any manual slots in hierarchy nodes referencing this deleted content
            $nodes = HierarchyNode::all()->filter(function ($node) use ($content) {
                $slots = $node->slots ?? [];

                return collect($slots)->contains('roster_content_id', $content->id);
            });

            foreach ($nodes as $node) {
                $slots = $node->slots;
                $changed = false;
                foreach ($slots as &$slot) {
                    if (isset($slot['roster_content_id']) && $slot['roster_content_id'] == $content->id) {
                        $slot['roster_content_id'] = null;
                        $slot['value'] = 'VACANT';
                        $changed = true;
                    }
                }
                if ($changed) {
                    $node->slots = $slots;
                    $node->save();

                    // Invalidate diagrams cache for this faction
                    $hierarchy = $node->hierarchy;
                    if ($hierarchy) {
                        Faction::invalidateDiagramsCache($hierarchy->faction_id);
                    }
                }
            }
        });
    }

    protected $fillable = [
        'section_id',
        'order',
        'type',
        'color',
        'content',
        'notes',
        'created_by',
        'editing_by',
        'editing_at',
        'editing_col',
    ];

    protected $casts = [
        'content' => 'array',
        'notes' => 'array',
        'editing_at' => 'datetime',
    ];

    public function section()
    {
        return $this->belongsTo(RosterSection::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function editor()
    {
        return $this->belongsTo(User::class, 'editing_by');
    }
}
