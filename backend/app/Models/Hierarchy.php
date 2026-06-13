<?php

namespace App\Models;

use App\Events\HierarchyUpdated;
use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Hierarchy extends Model
{
    use Auditable, SoftDeletes;

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
    }

    protected $fillable = [
        'faction_id',
        'name',
        'color',
        'order',
        'roster_id',
        'created_by',
    ];

    public function faction()
    {
        return $this->belongsTo(Faction::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function roster()
    {
        return $this->belongsTo(Roster::class);
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
