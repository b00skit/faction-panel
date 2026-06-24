<?php

namespace App\Http\Controllers;

use App\Models\Faction;
use App\Models\FactionInvite;
use App\Models\Role;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class InviteController extends Controller
{
    public function index(Request $request, $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();

        if (! User::hasFactionPermission(Auth::user(), $faction, 'manage_invites')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $status = $request->query('status', 'active');
        $query = $faction->invites()->with(['creator:id,username', 'role', 'groups'])->latest();

        if ($status === 'active') {
            $query->where(function ($q) {
                $q->whereNull('expires_at')
                    ->orWhere('expires_at', '>', Carbon::now());
            })->where(function ($q) {
                $q->whereNull('max_uses')
                    ->orWhereRaw('uses < max_uses');
            });
        } elseif ($status === 'inactive') {
            $query->where(function ($q) {
                $q->where(function ($sub) {
                    $sub->whereNotNull('expires_at')
                        ->where('expires_at', '<=', Carbon::now());
                })->orWhere(function ($sub) {
                    $sub->whereNotNull('max_uses')
                        ->whereRaw('uses >= max_uses');
                });
            });
        }

        $invites = $query->get();

        $this->audit('invite.list', "Viewed invites list for faction {$faction->name}");

        return response()->json($invites);
    }

    public function store(Request $request, $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();

        if (! User::hasFactionPermission(Auth::user(), $faction, 'manage_invites')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'duration' => 'required|in:1h,3h,6h,12h,24h,48h,7d,30d,never',
            'max_uses' => 'nullable|integer|min:0',
            'role_id' => 'nullable|integer|exists:roles,id',
            'group_ids' => 'nullable|array',
            'group_ids.*' => 'integer|exists:groups,id',
            'field_values' => 'nullable|array',
        ]);

        $roleId = $request->input('role_id') ? (int) $request->input('role_id') : null;
        if ($roleId) {
            $role = Role::where('faction_id', $faction->id)->findOrFail($roleId);
            $user = $request->user();
            $userHighestWeight = $user->is_superadmin || $faction->faction_leader === $user->id
                ? PHP_INT_MAX
                : $user->getHighestRoleWeight($faction->id);

            if ($role->weight >= $userHighestWeight) {
                return response()->json(['message' => 'Cannot assign a role with weight equal to or higher than yours.'], 403);
            }
        }

        $groupIds = $request->input('group_ids', []);
        if (! empty($groupIds)) {
            $validGroupsCount = $faction->groups()->whereIn('id', $groupIds)->count();
            if ($validGroupsCount !== count($groupIds)) {
                return response()->json(['message' => 'One or more groups are invalid or do not belong to this faction.'], 422);
            }
        }

        $fieldValues = $request->input('field_values', []);
        if (! empty($fieldValues)) {
            $validFieldsCount = \App\Models\FactionUserField::where('faction_id', $faction->id)
                ->whereIn('id', array_keys($fieldValues))
                ->count();
            if ($validFieldsCount !== count($fieldValues)) {
                return response()->json(['message' => 'One or more user fields are invalid.'], 422);
            }
        }

        $expiresAt = null;
        if ($request->duration !== 'never') {
            $expiresAt = match ($request->duration) {
                '1h' => Carbon::now()->addHour(),
                '3h' => Carbon::now()->addHours(3),
                '6h' => Carbon::now()->addHours(6),
                '12h' => Carbon::now()->addHours(12),
                '24h' => Carbon::now()->addDay(),
                '48h' => Carbon::now()->addDays(2),
                '7d' => Carbon::now()->addWeek(),
                '30d' => Carbon::now()->addDays(30),
            };
        }

        $invite = $faction->invites()->create([
            'code' => Str::random(8),
            'expires_at' => $expiresAt,
            'max_uses' => $request->max_uses == 0 ? null : $request->max_uses,
            'role_id' => $roleId,
            'created_by' => $request->user()->id,
            'field_values' => $fieldValues,
        ]);

        if (! empty($groupIds)) {
            $invite->groups()->attach($groupIds);
        }

        $this->audit('invite.create', "Created invite code '{$invite->code}' for faction '{$faction->name}'", null, $invite, null, $invite->getAttributes());

        return response()->json($invite->load(['creator:id,username', 'role', 'groups']), 201);
    }

    public function destroy($id)
    {
        $invite = FactionInvite::findOrFail($id);
        $faction = $invite->faction;

        if (! User::hasFactionPermission(Auth::user(), $faction, 'manage_invites')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('invite.delete', "Deleted invite code '{$invite->code}' for faction '{$faction->name}'", null, $invite, $invite->getAttributes());

        $invite->delete();

        return response()->json(['message' => 'Invite deleted successfully']);
    }

    public function show($code)
    {
        $invite = FactionInvite::where('code', $code)->firstOrFail();
        $faction = $invite->faction;

        if (! $invite->isValid()) {
            return response()->json(['message' => 'This invite has expired or reached its usage limit.'], 410);
        }

        if ($faction->access === 'private') {
            return response()->json(['message' => 'This organization is not accepting new members via invite links.'], 403);
        }

        $this->audit('invite.view', "Viewed details for invite code '{$invite->code}' of faction '{$faction->name}'", null, $invite);

        return response()->json([
            'id' => $faction->id,
            'name' => $faction->name,
            'shortname' => $faction->shortname,
            'description' => $faction->description,
            'color' => $faction->color,
            'image_url' => $faction->image_url,
            'visibility' => $faction->visibility,
            'access' => $faction->access,
            'invite' => [
                'code' => $invite->code,
                'expires_at' => $invite->expires_at,
                'max_uses' => $invite->max_uses,
                'uses' => $invite->uses,
            ],
        ]);
    }

    public function join(Request $request, $code)
    {
        $invite = FactionInvite::where('code', $code)->firstOrFail();
        $faction = $invite->faction;

        if (! $invite->isValid()) {
            return response()->json(['message' => 'This invite has expired or reached its usage limit.'], 410);
        }

        if ($faction->access === 'private') {
            return response()->json(['message' => 'This organization is not accepting new members via invite links.'], 403);
        }

        $user = $request->user();

        if ($faction->users()->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'You are already a member of this faction.'], 422);
        }

        $faction->users()->attach($user->id);
        $invite->increment('uses');

        // Apply pre-filled custom user field values
        if ($invite->field_values && is_array($invite->field_values)) {
            foreach ($invite->field_values as $fieldId => $val) {
                $field = \App\Models\FactionUserField::where('faction_id', $faction->id)->find($fieldId);
                if ($field) {
                    $coercedValue = $val;
                    if ($field->type === 'checkbox') {
                        $coercedValue = ($val === '1' || $val === 'true' || $val === true || $val === 'yes') ? '1' : '0';
                    } else {
                        $coercedValue = $val !== null ? (string) $val : null;
                    }
                    \App\Models\FactionUserFieldValue::updateOrCreate(
                        [
                            'user_id' => $user->id,
                            'faction_user_field_id' => $field->id,
                        ],
                        [
                            'value' => $coercedValue,
                        ]
                    );
                }
            }
        }

        // Assign role attached to the invite, or fall back to default User role
        if ($invite->role_id) {
            $user->roles()->attach($invite->role_id);
        } else {
            $userRole = $faction->roles()->where('name', 'User')->first();
            if ($userRole) {
                $user->roles()->attach($userRole->id);
            }
        }

        // Auto-assign groups attached to the invite
        $inviteGroupIds = $invite->groups()->pluck('groups.id')->toArray();
        if (! empty($inviteGroupIds)) {
            $user->groups()->syncWithoutDetaching(
                array_fill_keys($inviteGroupIds, ['is_leader' => false])
            );
        }

        $this->audit('invite.join', "User '{$user->username}' joined faction '{$faction->name}' using invite code '{$invite->code}'", null, $invite);

        return response()->json([
            'message' => 'Successfully joined '.$faction->name,
            'shortname' => $faction->shortname,
        ]);
    }
}
