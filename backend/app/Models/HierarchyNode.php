<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HierarchyNode extends Model
{
    protected $fillable = [
        'hierarchy_id',
        'parent_id',
        'title',
        'color',
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
