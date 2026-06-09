<?php

namespace App\Models;

use App\Events\HierarchyUpdated;
use Illuminate\Database\Eloquent\Model;

class HierarchyNode extends Model
{
    protected static function booted()
    {
        static::created(function ($node) {
            $hierarchy = $node->hierarchy;
            if ($hierarchy) {
                Faction::invalidateDiagramsCache($hierarchy->faction_id);
                HierarchyUpdated::dispatch($hierarchy->faction_id, $hierarchy->id);
            }
        });

        static::updated(function ($node) {
            $hierarchy = $node->hierarchy;
            if ($hierarchy) {
                Faction::invalidateDiagramsCache($hierarchy->faction_id);
                HierarchyUpdated::dispatch($hierarchy->faction_id, $hierarchy->id);
            }
        });

        static::deleted(function ($node) {
            $hierarchy = $node->hierarchy;
            if ($hierarchy) {
                Faction::invalidateDiagramsCache($hierarchy->faction_id);
                HierarchyUpdated::dispatch($hierarchy->faction_id, $hierarchy->id);
            }
        });
    }

    protected $fillable = [
        'hierarchy_id',
        'parent_id',
        'title',
        'color',
        'card_style',
        'image_url',
        'icon',
        'slots',
        'order',
        'roster_sync_config',
    ];

    protected $casts = [
        'slots' => 'array',
        'roster_sync_config' => 'array',
    ];

    public function hierarchy()
    {
        return $this->belongsTo(Hierarchy::class);
    }

    public function parent()
    {
        return $this->belongsTo(HierarchyNode::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(HierarchyNode::class, 'parent_id')->with('children')->orderBy('order')->orderBy('id');
    }
}
