<?php

namespace App\Models;

use App\Events\RosterUpdated;
use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Roster extends Model
{
    use Auditable, SoftDeletes;

    protected static function booted()
    {
        static::saved(function ($roster) {
            Faction::invalidateRosterCache($roster->faction_id);
            RosterUpdated::dispatch($roster);
        });
        static::deleted(function ($roster) {
            Faction::invalidateRosterCache($roster->faction_id);
            RosterUpdated::dispatch($roster);
        });
    }

    protected $fillable = [
        'faction_id',
        'name',
        'shortname',
        'color',
        'order',
        'roster_options',
        'columns',
        'counts',
        'layout_settings',
        'default_sections_per_row',
        'created_by',
        'is_sandbox',
    ];

    protected $casts = [
        'roster_options' => 'array',
        'columns' => 'array',
        'counts' => 'array',
        'layout_settings' => 'array',
        'is_sandbox' => 'boolean',
    ];

    public function faction()
    {
        return $this->belongsTo(Faction::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function sections()
    {
        return $this->hasMany(RosterSection::class);
    }

    public function rootSections()
    {
        return $this->hasMany(RosterSection::class)->whereNull('parent_id')->orderBy('order')->orderBy('id');
    }

    public function rosterPermissions()
    {
        return $this->hasMany(RosterPermission::class);
    }
}
