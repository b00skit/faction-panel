<?php

namespace App\Models;

use App\Events\RosterUpdated;
use Illuminate\Database\Eloquent\Model;

class RosterExclusion extends Model
{
    protected static function booted()
    {
        $clear = function ($rosterExclusion) {
            $roster = Roster::find($rosterExclusion->roster_id);
            if ($roster) {
                Faction::invalidateRosterCache($roster->faction_id);
                User::clearPermissionsCache();
                RosterUpdated::dispatch($roster);
            }
        };
        static::saved($clear);
        static::deleted($clear);
    }

    protected $fillable = [
        'roster_id',
        'role_id',
    ];

    public function roster()
    {
        return $this->belongsTo(Roster::class);
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }
}
