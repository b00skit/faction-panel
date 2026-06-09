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
        $clear = function ($section) {
            $roster = $section->roster;
            if ($roster) {
                Faction::invalidateRosterCache($roster->faction_id);
                RosterUpdated::dispatch($roster);
            }
        };
        static::saved($clear);
        static::deleted($clear);
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
