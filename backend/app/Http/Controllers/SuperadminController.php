<?php

namespace App\Http\Controllers;

use App\Models\Faction;
use App\Models\MembershipTier;
use App\Models\Notification;
use App\Models\SiteSetting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class SuperadminController extends Controller
{
    private function checkSuperadmin(Request $request)
    {
        if (! $request->user() || ! $request->user()->is_superadmin) {
            abort(403, 'Unauthorized access.');
        }
    }

    public function getSettings(Request $request)
    {
        $this->checkSuperadmin($request);

        $this->audit('superadmin.settings.view', 'Viewed superadmin site settings');

        return SiteSetting::all()->pluck('value', 'key');
    }

    public function getPublicSettings()
    {
        $this->audit('site_settings.view_public', 'Viewed public site settings');

        return SiteSetting::whereIn('key', ['version', 'allow_registration'])->pluck('value', 'key');
    }

    public function updateSettings(Request $request)
    {
        $this->checkSuperadmin($request);

        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.*' => 'nullable|string',
        ]);

        foreach ($validated['settings'] as $key => $value) {
            SiteSetting::updateOrCreate(['key' => $key], ['value' => $value]);
        }

        $this->audit('superadmin.settings.update', 'Updated superadmin site settings', null, null, null, $validated['settings']);

        return response()->json(['message' => 'Settings updated successfully']);
    }

    public function getUsers(Request $request)
    {
        $this->checkSuperadmin($request);

        $this->audit('superadmin.users.view', 'Viewed list of users');

        // Include counts and membership tier for display
        return User::with(['membershipTier'])->withCount('factions')->get();
    }

    public function storeUser(Request $request)
    {
        $this->checkSuperadmin($request);

        $validated = $request->validate([
            'username' => 'required|string|max:255|unique:users,username',
            'gtaw_id' => 'nullable|integer|unique:users,gtaw_id',
            'gtaw_username' => 'nullable|string|max:255',
            'is_superadmin' => 'boolean',
            'membership_tier_id' => 'nullable|exists:membership_tiers,id',
            'password' => 'nullable|string|min:8',
        ]);

        if (! empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user = User::create($validated);

        $this->audit('superadmin.users.create', "Created user '{$user->username}'", null, $user, null, $user->getAttributes());

        return response()->json(['message' => 'User created successfully', 'user' => $user->load('membershipTier')], 201);
    }

    public function updateUser(Request $request, User $user)
    {
        $this->checkSuperadmin($request);

        $validated = $request->validate([
            'username' => 'required|string|max:255|unique:users,username,'.$user->id,
            'gtaw_id' => 'nullable|integer',
            'gtaw_username' => 'nullable|string|max:255',
            'is_superadmin' => 'boolean',
            'membership_tier_id' => 'nullable|exists:membership_tiers,id',
        ]);

        $oldValues = $user->getOriginal();
        $user->update($validated);

        $this->audit('superadmin.users.update', "Updated user '{$user->username}'", null, $user, $oldValues, $user->getDirty());

        return response()->json(['message' => 'User updated successfully', 'user' => $user->load('membershipTier')]);
    }

    public function getMembershipTiers(Request $request)
    {
        $this->checkSuperadmin($request);

        $this->audit('superadmin.membership_tiers.view', 'Viewed membership tiers');

        return MembershipTier::withCount('users')->get();
    }

    public function storeMembershipTier(Request $request)
    {
        $this->checkSuperadmin($request);
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'max_factions' => 'required|integer|min:0',
            'allow_custom_branding' => 'boolean',
        ]);

        $tier = MembershipTier::create($validated);

        $this->audit('superadmin.membership_tiers.create', "Created membership tier '{$tier->name}'", null, $tier, null, $tier->getAttributes());

        return response()->json($tier, 201);
    }

    public function updateMembershipTier(Request $request, MembershipTier $tier)
    {
        $this->checkSuperadmin($request);
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'max_factions' => 'required|integer|min:0',
            'allow_custom_branding' => 'boolean',
        ]);

        $oldValues = $tier->getOriginal();
        $tier->update($validated);

        $this->audit('superadmin.membership_tiers.update', "Updated membership tier '{$tier->name}'", null, $tier, $oldValues, $tier->getDirty());

        return response()->json($tier);
    }

    public function deleteMembershipTier(Request $request, MembershipTier $tier)
    {
        $this->checkSuperadmin($request);

        $this->audit('superadmin.membership_tiers.delete', "Deleted membership tier '{$tier->name}'", null, $tier, $tier->getAttributes());

        $tier->delete();

        return response()->json(['message' => 'Membership tier deleted successfully']);
    }

    public function deleteUser(Request $request, User $user)
    {
        $this->checkSuperadmin($request);

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Cannot delete yourself.'], 400);
        }

        // Handle faction leaderships before deleting?
        // For now just standard delete or set to null
        $this->audit('superadmin.users.delete', "Deleted user '{$user->username}'", null, $user, $user->getAttributes());

        $user->delete();

        return response()->json(['message' => 'User deleted successfully']);
    }

    public function getFactions(Request $request)
    {
        $this->checkSuperadmin($request);

        $this->audit('superadmin.factions.view', 'Viewed list of factions');

        return Faction::with('leader')->withCount('users')->get();
    }

    public function updateFaction(Request $request, Faction $faction)
    {
        $this->checkSuperadmin($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'shortname' => 'required|string|alpha_dash|max:20|unique:factions,shortname,'.$faction->id,
            'faction_leader' => 'nullable|exists:users,id',
        ]);

        $oldValues = $faction->getOriginal();
        $faction->update($validated);

        // If leadership changed, ensure they are in the faction
        if ($request->has('faction_leader') && $request->faction_leader) {
            if (! $faction->users()->where('users.id', $request->faction_leader)->exists()) {
                $faction->users()->attach($request->faction_leader);
            }
        }

        $this->audit('superadmin.factions.update', "Updated faction '{$faction->name}'", null, $faction, $oldValues, $faction->getDirty());

        return response()->json(['message' => 'Faction updated successfully', 'faction' => $faction->load('leader')]);
    }

    public function deleteFaction(Request $request, Faction $faction)
    {
        $this->checkSuperadmin($request);

        $this->audit('superadmin.factions.delete', "Deleted faction '{$faction->name}'", null, $faction, $faction->getAttributes());

        $faction->delete();

        return response()->json(['message' => 'Faction deleted successfully']);
    }

    public function impersonate(Request $request, User $user)
    {
        $this->checkSuperadmin($request);

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Cannot impersonate yourself.'], 400);
        }

        $this->audit('superadmin.impersonate', "Started impersonation of user '{$user->username}'", null, $user);

        // Issue a token for the target user
        $token = $user->createToken('impersonation_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user->load('groups', 'factions'),
        ]);
    }

    public function getSystemNotifications(Request $request)
    {
        $this->checkSuperadmin($request);

        $this->audit('superadmin.notifications.view', 'Viewed system notifications list');

        return Notification::where('type', 'system')
            ->with('user:id,username')
            ->orderBy('created_at', 'desc')
            ->get();
    }

    public function storeSystemNotification(Request $request)
    {
        $this->checkSuperadmin($request);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'user_id' => 'nullable|integer|exists:users,id',
            'link' => 'nullable|string|max:2048',
        ]);

        $notif = Notification::create([
            'type' => 'system',
            'title' => $validated['title'],
            'message' => $validated['message'],
            'link' => $validated['link'] ?? null,
            'user_id' => $validated['user_id'] ?? null,
            'is_read' => false,
        ]);

        $targetText = $notif->user_id ? "user '{$notif->user->username}'" : 'all users';
        $this->audit('superadmin.notifications.create', "Created system notification '{$notif->title}' targeting {$targetText}", null, $notif, null, $notif->getAttributes());

        return response()->json($notif->load('user:id,username'), 201);
    }

    public function deleteSystemNotification(Request $request, Notification $notification)
    {
        $this->checkSuperadmin($request);

        if ($notification->type !== 'system') {
            return response()->json(['message' => 'Invalid notification type.'], 400);
        }

        $this->audit('superadmin.notifications.delete', "Deleted system notification '{$notification->title}'", null, $notification, $notification->getAttributes());

        $notification->delete();

        return response()->json(['message' => 'System notification deleted successfully']);
    }
}
