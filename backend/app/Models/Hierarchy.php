<?php

namespace App\Models;

use App\Events\HierarchyUpdated;
use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Hierarchy extends Model
{
    use Auditable, SoftDeletes;

    public $tempRosterIds = null;

    protected static function booted()
    {
        static::created(function ($hierarchy) {
            Faction::invalidateDiagramsCache($hierarchy->faction_id);
            HierarchyUpdated::dispatch($hierarchy->faction_id, $hierarchy->id);
        });

        static::updated(function ($hierarchy) {
            Faction::invalidateDiagramsCache($hierarchy->faction_id);
            HierarchyUpdated::dispatch($hierarchy->faction_id, $hierarchy->id);
        });

        static::deleted(function ($hierarchy) {
            Faction::invalidateDiagramsCache($hierarchy->faction_id);
            HierarchyUpdated::dispatch($hierarchy->faction_id, $hierarchy->id);
        });

        static::saved(function ($hierarchy) {
            if ($hierarchy->tempRosterIds !== null) {
                $hierarchy->rosters()->sync($hierarchy->tempRosterIds);
                $hierarchy->tempRosterIds = null;
            }
        });
    }

    protected $fillable = [
        'faction_id',
        'name',
        'color',
        'order',
        'roster_id',
        'roster_ids',
        'created_by',
    ];

    protected $appends = [
        'roster_ids',
        'roster_id',
    ];

    public function getRosterIdsAttribute()
    {
        return $this->rosters->pluck('id')->toArray();
    }

    public function getRosterIdAttribute()
    {
        return $this->roster_ids[0] ?? null;
    }

    public function setRosterIdAttribute($value)
    {
        $this->tempRosterIds = $value ? [$value] : [];
    }

    public function setRosterIdsAttribute($value)
    {
        $this->tempRosterIds = $value ?: [];
    }

    public function faction()
    {
        return $this->belongsTo(Faction::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function rosters()
    {
        return $this->belongsToMany(Roster::class, 'hierarchy_roster');
    }

    public function nodes()
    {
        return $this->hasMany(HierarchyNode::class);
    }

    public function rootNodes()
    {
        return $this->hasMany(HierarchyNode::class)->whereNull('parent_id')->orderBy('order')->orderBy('id');
    }

    public function hierarchyPermissions()
    {
        return $this->hasMany(HierarchyPermission::class);
    }
}
