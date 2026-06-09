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
                RosterRowAdded::dispatch($content);
            }
        });

        static::updated(function ($content) {
            $roster = $content->section?->roster;
            if ($roster) {
                Faction::invalidateRosterCache($roster->faction_id);
                RosterRowUpdated::dispatch($content);
            }
        });

        static::deleted(function ($content) {
            $roster = $content->section?->roster;
            if ($roster) {
                Faction::invalidateRosterCache($roster->faction_id);
                RosterRowDeleted::dispatch($content->id, $roster->id, $roster->faction_id);
            }
        });
    }

    protected $fillable = [
        'section_id',
        'order',
        'type',
        'color',
        'content',
        'created_by',
        'editing_by',
        'editing_at',
        'editing_col',
    ];

    protected $casts = [
        'content' => 'array',
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
