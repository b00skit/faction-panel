<?php

namespace App\Models;

use App\Events\NotificationCreated;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    use HasFactory;

    protected static function booted()
    {
        static::created(function ($notification) {
            $userIds = self::getEligibleUserIds($notification);
            if (! empty($userIds)) {
                event(new NotificationCreated($notification, $userIds));
            }
        });
    }

    public static function getEligibleUserIds(Notification $notification): array
    {
        $userIds = [];

        if ($notification->type !== 'faction') {
            // System or user notification
            if ($notification->user_id) {
                $userIds[] = $notification->user_id;
            } else {
                // Global system notification: broadcast to all users
                $userIds = User::pluck('id')->toArray();
            }

            return $userIds;
        }

        // Faction notification
        $factionId = $notification->faction_id;
        $schemeId = $notification->notification_scheme_id;
        if (! $factionId) {
            return [];
        }

        $faction = Faction::find($factionId);
        if (! $faction) {
            return [];
        }

        // 1. Add faction leader
        if ($faction->faction_leader) {
            $userIds[] = (int) $faction->faction_leader;
        }

        // 2. Add all superadmins
        $superadmins = User::where('is_superadmin', true)->pluck('id')->toArray();
        foreach ($superadmins as $saId) {
            $userIds[] = (int) $saId;
        }

        // 3. Add all users in the faction who are eligible based on roles/groups permissions
        $members = $faction->users()->get();

        $schemePermissions = NotificationSchemePermission::where('notification_scheme_id', $schemeId)
            ->whereJsonContains('permissions', 'receive')
            ->get();

        $allowedRoleIds = $schemePermissions->pluck('role_id')->filter()->map('intval')->toArray();
        $allowedGroupIds = $schemePermissions->pluck('group_id')->filter()->map('intval')->toArray();
        $hasNullPermission = $schemePermissions->contains(fn ($p) => is_null($p->role_id) && is_null($p->group_id));

        foreach ($members as $member) {
            $mId = (int) $member->id;
            if (in_array($mId, $userIds, true)) {
                continue;
            }

            // Check if user has administrator permission globally in faction
            if (User::hasFactionPermission($member, $faction, 'administrator')) {
                $userIds[] = $mId;

                continue;
            }

            // If scheme permissions has a null-null entry, it means any member of the faction receives it
            if ($hasNullPermission) {
                $userIds[] = $mId;

                continue;
            }

            // Check if user has one of the allowed roles
            $memberRoleIds = $member->roles()->where('faction_id', $factionId)->pluck('roles.id')->map('intval')->toArray();
            if (array_intersect($memberRoleIds, $allowedRoleIds)) {
                $userIds[] = $mId;

                continue;
            }

            // Check if user is in one of the allowed groups
            $memberGroupIds = $member->groups()->where('faction_id', $factionId)->pluck('groups.id')->map('intval')->toArray();
            if (array_intersect($memberGroupIds, $allowedGroupIds)) {
                $userIds[] = $mId;

                continue;
            }
        }

        return array_values(array_unique($userIds));
    }

    protected $fillable = [
        'faction_id',
        'notification_scheme_id',
        'user_id',
        'type',
        'title',
        'message',
        'data',
        'is_read',
    ];

    protected $casts = [
        'data' => 'array',
        'is_read' => 'boolean',
    ];

    public function faction()
    {
        return $this->belongsTo(Faction::class);
    }

    public function scheme()
    {
        return $this->belongsTo(NotificationScheme::class, 'notification_scheme_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reads()
    {
        return $this->hasMany(NotificationRead::class);
    }
}
