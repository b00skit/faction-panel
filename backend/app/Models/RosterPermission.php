<?php

namespace App\Models;

use App\Events\RosterUpdated;
use Illuminate\Database\Eloquent\Model;

class RosterPermission extends Model
{
    protected static function booted()
    {
        $clear = function ($rosterPermission) {
            $roster = Roster::find($rosterPermission->roster_id);
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
        'group_id',
        'role_id',
        'permissions',
    ];

    protected $casts = [
        'permissions' => 'array',
    ];

    public function roster()
    {
        return $this->belongsTo(Roster::class);
    }

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }
}
