<?php

use App\Models\Faction;
use App\Models\Roster;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::routes(['middleware' => ['api', 'auth:sanctum']]);

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('faction.{factionId}.updates', function ($user, $factionId) {
    $faction = Faction::find($factionId);
    if (! $faction) {
        return false;
    }

    return User::hasFactionPermission($user, $faction, 'view_faction_roster');
});

Broadcast::channel('faction.{factionId}.roster.{rosterId}', function ($user, $factionId, $rosterId) {
    $roster = Roster::find($rosterId);
    if (! $roster || (int) $roster->faction_id !== (int) $factionId) {
        return false;
    }

    if (User::canViewRoster($user, $roster)) {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'color' => $user->color, // Assuming user has a color or some identifiable info
        ];
    }

    return false;
});
