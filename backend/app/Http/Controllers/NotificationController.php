<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\NotificationRead;
use App\Models\NotificationScheme;
use App\Models\NotificationSchemePermission;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

class NotificationController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        $eligibleSchemeIds = [];

        foreach ($user->factions as $faction) {
            $isLeaderOrAdmin = $user->is_superadmin ||
                               $faction->faction_leader === $user->id ||
                               User::hasFactionPermission($user, $faction, 'administrator');

            $schemes = NotificationScheme::where('faction_id', $faction->id)->get();

            if ($isLeaderOrAdmin) {
                $eligibleSchemeIds = array_merge($eligibleSchemeIds, $schemes->pluck('id')->toArray());

                continue;
            }

            $roleIds = $user->roles()->where('faction_id', $faction->id)->pluck('roles.id')->toArray();
            $groupIds = $user->groups()->where('faction_id', $faction->id)->pluck('groups.id')->toArray();

            foreach ($schemes as $scheme) {
                $hasReceive = NotificationSchemePermission::where('notification_scheme_id', $scheme->id)
                    ->where(function ($q) use ($roleIds, $groupIds) {
                        $q->whereIn('role_id', $roleIds)
                            ->orWhereIn('group_id', $groupIds)
                            ->orWhere(function ($sub) {
                                $sub->whereNull('role_id')->whereNull('group_id');
                            });
                    })
                    ->whereJsonContains('permissions', 'receive')
                    ->exists();

                if ($hasReceive) {
                    $eligibleSchemeIds[] = $scheme->id;
                }
            }
        }

        $notifications = Notification::where(function ($q) use ($user, $eligibleSchemeIds) {
            $q->where(function ($sub) use ($user) {
                $sub->whereIn('type', ['system', 'user'])
                    ->where(function ($inner) use ($user) {
                        $inner->where('user_id', $user->id)
                            ->orWhereNull('user_id');
                    });
            })
                ->orWhere(function ($sub) use ($eligibleSchemeIds) {
                    $sub->where('type', 'faction')
                        ->whereIn('notification_scheme_id', $eligibleSchemeIds);
                });
        })
            ->with(['scheme', 'faction'])
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get();

        $userReads = NotificationRead::where('user_id', $user->id)
            ->pluck('notification_id')
            ->toArray();

        $results = $notifications->map(function ($notif) use ($userReads) {
            $isRead = false;
            if ($notif->type !== 'faction') {
                $isRead = $notif->is_read;
            } else {
                $readType = $notif->scheme->read_type ?? 'user_bound';
                if ($readType === 'global') {
                    $isRead = $notif->is_read;
                } else {
                    $isRead = in_array($notif->id, $userReads);
                }
            }

            return [
                'id' => $notif->id,
                'faction_id' => $notif->faction_id,
                'notification_scheme_id' => $notif->notification_scheme_id,
                'scheme_name' => $notif->scheme->name ?? null,
                'type' => $notif->type,
                'title' => $notif->title,
                'message' => $notif->message,
                'link' => $notif->link,
                'data' => $notif->data,
                'is_read' => $isRead,
                'created_at' => $notif->created_at,
                'faction_shortname' => $notif->faction->shortname ?? null,
            ];
        });

        $unreadCount = $results->where('is_read', false)->count();

        return response()->json([
            'notifications' => $results,
            'unread_count' => $unreadCount,
            'has_faction_access' => count($eligibleSchemeIds) > 0,
        ]);
    }

    public function read(Notification $notification)
    {
        $user = Auth::user();

        if ($notification->type !== 'faction') {
            if ($notification->user_id && $notification->user_id !== $user->id) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
            $notification->update(['is_read' => true]);
        } else {
            $scheme = $notification->scheme;
            if (! $scheme) {
                return response()->json(['message' => 'Scheme not found'], 404);
            }

            // Check if user is allowed to read
            $isAllowed = $user->is_superadmin ||
                         $scheme->faction->faction_leader === $user->id ||
                         User::hasFactionPermission($user, $scheme->faction, 'administrator');

            if (! $isAllowed) {
                $roleIds = $user->roles()->where('faction_id', $scheme->faction_id)->pluck('roles.id')->toArray();
                $groupIds = $user->groups()->where('faction_id', $scheme->faction_id)->pluck('groups.id')->toArray();

                $isAllowed = NotificationSchemePermission::where('notification_scheme_id', $scheme->id)
                    ->where(function ($q) use ($roleIds, $groupIds) {
                        $q->whereIn('role_id', $roleIds)
                            ->orWhereIn('group_id', $groupIds)
                            ->orWhere(function ($sub) {
                                $sub->whereNull('role_id')->whereNull('group_id');
                            });
                    })
                    ->whereJsonContains('permissions', 'read')
                    ->exists();
            }

            if (! $isAllowed) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            if ($scheme->read_type === 'global') {
                $notification->update(['is_read' => true]);
            } else {
                NotificationRead::firstOrCreate([
                    'notification_id' => $notification->id,
                    'user_id' => $user->id,
                ]);
            }
        }

        return response()->json(['message' => 'Notification marked as read']);
    }

    public function readAll()
    {
        $user = Auth::user();

        // Mark system / user notifications read
        Notification::whereIn('type', ['system', 'user'])
            ->where(function ($q) use ($user) {
                $q->where('user_id', $user->id)
                    ->orWhereNull('user_id');
            })
            ->update(['is_read' => true]);

        return response()->json(['message' => 'All system/user notifications marked as read']);
    }

    public function readScheme(NotificationScheme $scheme)
    {
        $user = Auth::user();

        // Verify faction access
        if (! $user->is_superadmin && ! $user->factions->contains('id', $scheme->faction_id)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $notifications = Notification::where('notification_scheme_id', $scheme->id)->get();

        if ($scheme->read_type === 'global') {
            Notification::where('notification_scheme_id', $scheme->id)->update(['is_read' => true]);
        } else {
            foreach ($notifications as $notif) {
                NotificationRead::firstOrCreate([
                    'notification_id' => $notif->id,
                    'user_id' => $user->id,
                ]);
            }
        }

        return response()->json(['message' => 'All scheme notifications marked as read']);
    }
}
