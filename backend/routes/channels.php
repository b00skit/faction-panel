<?php

use App\Models\Faction;
use App\Models\Roster;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Log;

Broadcast::routes(['middleware' => ['api', 'auth:sanctum']]);

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('faction.{factionId}.updates', function ($user, $factionId) {
    $faction = Faction::find($factionId);
    if (! $faction) {
        return false;
    }

    $canView = User::hasFactionPermission($user, $faction, 'view_faction_roster');
    Log::info("Updates Channel Auth Attempt: User ID={$user->id}, Username={$user->username}, Faction ID={$factionId}, Can View=".($canView ? 'YES' : 'NO'));

    if ($canView) {
        $primaryRole = $user->roles()
            ->where('faction_id', $faction->id)
            ->where('type', 'primary')
            ->first();
        $highestRole = $user->roles()
            ->where('faction_id', $faction->id)
            ->orderByDesc('weight')
            ->first();

        $role = $primaryRole ?? $highestRole;

        return [
            'id' => $user->id,
            'username' => $user->username,
            'avatar_url' => $user->avatar_url,
            'primary_role' => $role ? [
                'id' => $role->id,
                'name' => $role->name,
                'color' => $role->color,
                'weight' => $role->weight,
            ] : null,
        ];
    }

    return false;
});

Broadcast::channel('faction.{factionId}.roster.{rosterId}', function ($user, $factionId, $rosterId) {
    $roster = Roster::find($rosterId);
    if (! $roster || (int) $roster->faction_id !== (int) $factionId) {
        return false;
    }

    $canView = User::canViewRoster($user, $roster);
    Log::info("Roster Channel Auth Attempt: User ID={$user->id}, Username={$user->username}, Faction ID={$factionId}, Roster ID={$rosterId}, Can View=".($canView ? 'YES' : 'NO'));

    if ($canView) {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'color' => $user->color, // Assuming user has a color or some identifiable info
        ];
    }

    return false;
});

Broadcast::channel('faction.{factionId}.diagrams', function ($user, $factionId) {
    $faction = Faction::find($factionId);
    if (! $faction) {
        return false;
    }

    return User::hasFactionPermission($user, $faction, 'view_faction_hierarchy');
});
