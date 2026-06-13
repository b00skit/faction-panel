<?php

namespace App\Models;

use App\Events\RosterUpdated;
use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class RosterSection extends Model
{
    use Auditable, SoftDeletes;

    protected static function booted()
    {
        static::saved(function ($section) {
            $roster = $section->roster;
            if ($roster) {
                Faction::invalidateRosterCache($roster->faction_id);
                RosterUpdated::dispatch($roster);
            }
        });

        static::deleted(function ($section) {
            $roster = $section->roster;
            if ($roster) {
                Faction::invalidateRosterCache($roster->faction_id);
                RosterUpdated::dispatch($roster);
            }

            // Clean up any dynamic slot configurations referencing this section
            $nodes = HierarchyNode::all()->filter(function ($node) use ($section) {
                return isset($node->roster_sync_config['section_id']) && $node->roster_sync_config['section_id'] == $section->id;
            });

            foreach ($nodes as $node) {
                $config = $node->roster_sync_config;
                $config['enabled'] = false;
                $config['section_id'] = null;
                $node->roster_sync_config = $config;
                $node->slots = [];
                $node->save();

                $hierarchy = $node->hierarchy;
                if ($hierarchy) {
                    Faction::invalidateDiagramsCache($hierarchy->faction_id);
                }
            }

            // Also delete all roster contents belonging to this section.
            // Loop delete ensures model events (static::deleted) fire on each content row
            // to unlink any manual card slot links referencing them.
            foreach ($section->contents()->get() as $content) {
                $content->delete();
            }
        });
    }

    protected $fillable = [
        'roster_id',
        'name',
        'image_url',
        'shortname',
        'color',
        'type',
        'data_source',
        'order',
        'parent_id',
        'section_options',
        'columns',
        'use_roster_columns',
        'layout_settings',
        'counts',
        'subsections_per_row',
        'content_html',
        'created_by',
    ];

    protected $casts = [
        'section_options' => 'array',
        'columns' => 'array',
        'use_roster_columns' => 'boolean',
        'layout_settings' => 'array',
        'counts' => 'array',
    ];

    public function roster()
    {
        return $this->belongsTo(Roster::class);
    }

    public function parent()
    {
        return $this->belongsTo(RosterSection::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(RosterSection::class, 'parent_id')->with(['children', 'contents.editor'])->orderBy('order')->orderBy('id');
    }

    public function contents()
    {
        return $this->hasMany(RosterContent::class, 'section_id')->orderBy('order')->orderBy('id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
