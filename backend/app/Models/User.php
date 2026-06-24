<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['username', 'password', 'is_superadmin', 'avatar_url', 'gtaw_id', 'gtaw_username', 'gtaw_access_token', 'membership_tier_id'])]
#[Hidden(['password', 'remember_token', 'gtaw_id', 'gtaw_username', 'gtaw_access_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected $appends = ['max_factions', 'allow_custom_branding', 'gtaw_linked'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_superadmin' => 'boolean',
            'membership_tier_id' => 'integer',
            'allow_custom_branding' => 'boolean',
            'gtaw_linked' => 'boolean',
        ];
    }

    public function getGtawLinkedAttribute(): bool
    {
        return ! empty($this->gtaw_access_token);
    }

    public function membershipTier()
    {
        return $this->belongsTo(MembershipTier::class);
    }

    protected function getAvatarUrlAttribute($value)
    {
        if (! $value) {
            return null;
        }
        if (str_starts_with($value, 'http')) {
            return $value;
        }

        $baseUrl = env('STORAGE_URL');
        if (! $baseUrl) {
            $baseUrl = rtrim(config('app.url'), '/').'/storage';
        }

        return rtrim($baseUrl, '/').'/'.ltrim($value, '/');
    }

    protected function setAvatarUrlAttribute($value)
    {
        $this->attributes['avatar_url'] = $this->stripStorageUrl($value);
    }

    private function stripStorageUrl($value)
    {
        if (! $value) {
            return null;
        }

        $bases = array_filter([
            env('STORAGE_URL'),
            rtrim(config('app.url'), '/').'/storage',
            rtrim(Storage::disk('public')->url(''), '/'),
        ]);

        foreach ($bases as $base) {
            $base = rtrim($base, '/');
            if (str_starts_with($value, $base)) {
                return ltrim(str_replace($base, '', $value), '/');
            }
        }

        return $value;
    }

    public function getMaxFactionsAttribute(): int
    {
        if ($this->is_superadmin) {
            return PHP_INT_MAX;
        }

        return $this->membershipTier ? $this->membershipTier->max_factions : 1;
    }

    public function getAllowCustomBrandingAttribute(): bool
    {
        if ($this->is_superadmin) {
            return true;
        }

        return $this->membershipTier ? $this->membershipTier->allow_custom_branding : false;
    }

    public function factions()
    {
        return $this->belongsToMany(Faction::class)->withTimestamps();
    }

    public function roles()
    {
        return $this->belongsToMany(Role::class)->withTimestamps();
    }

    public function groups()
    {
        return $this->belongsToMany(Group::class)->withPivot('is_leader')->withTimestamps();
    }

    public function factionUserFieldValues()
    {
        return $this->hasMany(FactionUserFieldValue::class);
    }

    public function ownedRosters()
    {
        return $this->hasMany(Roster::class, 'created_by');
    }

    public function ownedDatabases()
    {
        return $this->hasMany(FactionRecordDatabase::class, 'created_by');
    }

    public function ownedStatistics()
    {
        return $this->hasMany(StatisticsModel::class, 'created_by');
    }

    protected static $userGroupsCache = [];

    protected static $userRolesCache = [];

    protected static $factionPermissionsCache = [];

    protected static $rosterPermissionsCache = [];

    protected static $recordPermissionsCache = [];

    protected static $statisticsPermissionsCache = [];

    protected static $formPermissionsCache = [];

    protected static $hierarchyPermissionsCache = [];

    protected static $exclusionCheckedCache = [];

    public static function clearPermissionsCache()
    {
        self::$userGroupsCache = [];
        self::$userRolesCache = [];
        self::$factionPermissionsCache = [];
        self::$rosterPermissionsCache = [];
        self::$recordPermissionsCache = [];
        self::$statisticsPermissionsCache = [];
        self::$formPermissionsCache = [];
        self::$hierarchyPermissionsCache = [];
        self::$exclusionCheckedCache = [];
    }

    protected static function shouldCache(): bool
    {
        return ! app()->runningUnitTests() || request()->route() !== null;
    }

    public static function getUserGroupIds(?User $user, int $factionId): Collection
    {
        if (! $user) {
            return collect();
        }
        $cacheKey = "{$user->id}_{$factionId}";
        $shouldCache = self::shouldCache();
        if (! $shouldCache || ! isset(self::$userGroupsCache[$cacheKey])) {
            $val = $user->groups()->where('faction_id', $factionId)->pluck('groups.id');
            if ($shouldCache) {
                self::$userGroupsCache[$cacheKey] = $val;
            }

            return $val;
        }

        return self::$userGroupsCache[$cacheKey];
    }

    public static function getUserRoleIds(?User $user, int $factionId): Collection
    {
        if (! $user) {
            return collect();
        }
        $cacheKey = "{$user->id}_{$factionId}";
        $shouldCache = self::shouldCache();
        if (! $shouldCache || ! isset(self::$userRolesCache[$cacheKey])) {
            $val = $user->roles()->where('faction_id', $factionId)->pluck('roles.id');
            if ($shouldCache) {
                self::$userRolesCache[$cacheKey] = $val;
            }

            return $val;
        }

        return self::$userRolesCache[$cacheKey];
    }

    public static function getFactionPermissions(?User $user, Faction $faction): array
    {
        $userId = $user ? $user->id : 'guest';
        $cacheKey = "{$userId}_{$faction->id}";
        $shouldCache = self::shouldCache();

        if ($shouldCache && isset(self::$factionPermissionsCache[$cacheKey])) {
            return self::$factionPermissionsCache[$cacheKey];
        }

        if ($user && $user->is_superadmin) {
            $allKeys = [];
            foreach (config('permissions.categories', []) as $category) {
                foreach ($category['permissions'] as $key => $details) {
                    $allKeys[] = $key;
                }
            }
            if ($shouldCache) {
                self::$factionPermissionsCache[$cacheKey] = $allKeys;
            }

            return $allKeys;
        }

        if ($user && $faction->faction_leader === $user->id) {
            $allKeys = [];
            foreach (config('permissions.categories', []) as $category) {
                foreach ($category['permissions'] as $key => $details) {
                    $allKeys[] = $key;
                }
            }
            if ($shouldCache) {
                self::$factionPermissionsCache[$cacheKey] = $allKeys;
            }

            return $allKeys;
        }

        $roles = collect();

        // 1. Always get Public role permissions if faction is public/hidden
        if (in_array($faction->visibility, ['public', 'hidden'])) {
            $publicRole = $faction->roles()->where('name', 'Public')->with('permissions')->first();
            if ($publicRole) {
                $roles->push($publicRole);
            }
        }

        // 2. Add specific user roles if user is logged in
        if ($user) {
            $userRoles = $user->roles()->where('faction_id', $faction->id)->with('permissions')->get();
            foreach ($userRoles as $role) {
                if (! $roles->contains('id', $role->id)) {
                    $roles->push($role);
                }
            }
        }

        if ($roles->isEmpty()) {
            if ($shouldCache) {
                self::$factionPermissionsCache[$cacheKey] = [];
            }

            return [];
        }

        $isSystemAdmin = false;
        foreach ($roles as $role) {
            if ($role->permissions->where('permission_key', 'administrator')->where('value', 'YES')->first()) {
                $isSystemAdmin = true;
                break;
            }
        }

        $leaderOnlyPermissions = [
            'delete_faction',
        ];

        $resolved = [];
        $allKeys = [];
        foreach (config('permissions.categories', []) as $category) {
            foreach ($category['permissions'] as $key => $details) {
                $allKeys[] = $key;
            }
        }
        foreach ($roles as $role) {
            foreach ($role->permissions as $permission) {
                $allKeys[] = $permission->permission_key;
            }
        }
        $allKeys = array_unique($allKeys);

        foreach ($allKeys as $key) {
            if ($isSystemAdmin && ! in_array($key, $leaderOnlyPermissions)) {
                $resolved[] = $key;

                continue;
            }

            $hasNever = false;
            $hasYes = false;

            foreach ($roles as $role) {
                $permission = $role->permissions->where('permission_key', $key)->first();
                if ($permission) {
                    if ($permission->value === 'NEVER') {
                        $hasNever = true;
                        break;
                    }
                    if ($permission->value === 'YES') {
                        $hasYes = true;
                    }
                }
            }

            if ($hasYes && ! $hasNever) {
                $resolved[] = $key;
            }
        }

        if ($shouldCache) {
            self::$factionPermissionsCache[$cacheKey] = $resolved;
        }

        return $resolved;
    }

    public static function hasFactionPermission(?User $user, Faction $faction, string $permissionKey): bool
    {
        if ($user && $user->is_superadmin) {
            return true;
        }

        if ($user && $faction->faction_leader === $user->id) {
            return true;
        }

        return in_array($permissionKey, self::getFactionPermissions($user, $faction));
    }

    public function hasPermission(string $permissionKey, int $factionId): bool
    {
        $faction = Faction::find($factionId);
        if (! $faction) {
            return false;
        }

        return self::hasFactionPermission($this, $faction, $permissionKey);
    }

    public function getHighestRoleWeight(int $factionId): int
    {
        if ($this->is_superadmin) {
            return PHP_INT_MAX;
        }

        $faction = Faction::find($factionId);
        if ($faction && $faction->faction_leader === $this->id) {
            return PHP_INT_MAX;
        }

        return $this->roles()
            ->where('faction_id', $factionId)
            ->max('weight') ?? 0;
    }

    public function isGroupLeaderInFaction(int $factionId): bool
    {
        return $this->groups()
            ->where('faction_id', $factionId)
            ->wherePivot('is_leader', true)
            ->exists();
    }

    public static function hasRosterPermission(?User $user, Roster $roster, string $permissionKey): bool
    {
        if ($roster->is_sandbox) {
            return $user &&
                   $roster->created_by === $user->id &&
                   self::hasFactionPermission($user, $roster->faction, 'utilize_sandbox_rosters');
        }

        $faction = $roster->faction;

        // Faction leader is always exempt.
        if ($user && $faction->faction_leader === $user->id) {
            return true;
        }

        // Exclusion check: if user has any excluded role on this roster, deny access
        if ($user) {
            $userRoleIds = self::getUserRoleIds($user, $faction->id)->toArray();
            if (! empty($userRoleIds)) {
                $roleIdsKey = implode(',', $userRoleIds);
                $exclusionCacheKey = "{$roster->id}_{$roleIdsKey}";
                if (! isset(self::$exclusionCheckedCache[$exclusionCacheKey])) {
                    self::$exclusionCheckedCache[$exclusionCacheKey] = RosterExclusion::where('roster_id', $roster->id)
                        ->whereIn('role_id', $userRoleIds)
                        ->exists();
                }
                if (self::$exclusionCheckedCache[$exclusionCacheKey]) {
                    return false;
                }
            }
        }

        // 1. Superadmin/Faction Leader/Global Roster Moderator/Creator always have access
        if ($user) {
            if ($user->is_superadmin ||
                self::hasFactionPermission($user, $faction, 'global_roster_moderation') ||
                $roster->created_by === $user->id
            ) {
                return true;
            }
        }

        $userId = $user ? $user->id : 'guest';
        $cacheKey = "{$userId}_{$roster->id}";

        if (! isset(self::$rosterPermissionsCache[$cacheKey])) {
            $permissionSets = collect();

            // Public permissions (group_id and role_id are null)
            $publicPerms = $roster->rosterPermissions->whereNull('group_id')->whereNull('role_id')->first();
            if ($publicPerms) {
                $permissionSets->push($publicPerms->permissions);
            }

            if ($user) {
                // Group permissions
                $userGroupIds = self::getUserGroupIds($user, $faction->id);
                $groupPerms = $roster->rosterPermissions->whereIn('group_id', $userGroupIds);
                foreach ($groupPerms as $gp) {
                    $permissionSets->push($gp->permissions);
                }

                // Role permissions
                $userRoleIds = self::getUserRoleIds($user, $faction->id);
                $rolePerms = $roster->rosterPermissions->whereIn('role_id', $userRoleIds);
                foreach ($rolePerms as $rp) {
                    $permissionSets->push($rp->permissions);
                }
            }

            $resolved = [];
            foreach ($permissionSets as $set) {
                if (is_array($set)) {
                    foreach ($set as $perm) {
                        $resolved[] = $perm;
                    }
                }
            }
            self::$rosterPermissionsCache[$cacheKey] = array_unique($resolved);
        }

        return in_array($permissionKey, self::$rosterPermissionsCache[$cacheKey]);
    }

    public static function canViewRoster(?User $user, Roster $roster): bool
    {
        if ($roster->is_sandbox) {
            return $user &&
                   $roster->created_by === $user->id &&
                   self::hasFactionPermission($user, $roster->faction, 'utilize_sandbox_rosters');
        }

        $faction = $roster->faction;
        if ($user && $faction->faction_leader === $user->id) {
            return true;
        }

        // Exclusion check: if user has any excluded role on this roster, deny access
        if ($user) {
            $userRoleIds = self::getUserRoleIds($user, $faction->id)->toArray();
            if (! empty($userRoleIds)) {
                $roleIdsKey = implode(',', $userRoleIds);
                $exclusionCacheKey = "{$roster->id}_{$roleIdsKey}";
                if (! isset(self::$exclusionCheckedCache[$exclusionCacheKey])) {
                    self::$exclusionCheckedCache[$exclusionCacheKey] = RosterExclusion::where('roster_id', $roster->id)
                        ->whereIn('role_id', $userRoleIds)
                        ->exists();
                }
                if (self::$exclusionCheckedCache[$exclusionCacheKey]) {
                    return false;
                }
            }
        }

        if ($user && $user->is_superadmin) {
            return true;
        }

        if ($user && self::hasFactionPermission($user, $faction, 'global_roster_moderation')) {
            return true;
        }

        if ($user && $roster->created_by === $user->id) {
            return true;
        }

        $hasExplicitPerms = $roster->rosterPermissions->isNotEmpty();
        if ($hasExplicitPerms) {
            return self::hasRosterPermission($user, $roster, 'view_roster');
        }

        // If no permissions are set for a roster, then it should not appear publicly for anyone
        // apart from roster owner + faction owner + roster master. Since those are handled by the
        // bypass checks above, we return false here.
        return false;
    }

    public static function hasHierarchyPermission(?User $user, Hierarchy $hierarchy, string $permissionKey): bool
    {
        $faction = $hierarchy->faction;

        // 1. Superadmin/Faction Leader/Global Hierarchy Moderator/Creator always have access
        if ($user) {
            if ($user->is_superadmin ||
                $faction->faction_leader === $user->id ||
                self::hasFactionPermission($user, $faction, 'global_hierarchy_moderation') ||
                $hierarchy->created_by === $user->id
            ) {
                return true;
            }
        }

        $userId = $user ? $user->id : 'guest';
        $cacheKey = "{$userId}_{$hierarchy->id}";

        if (! isset(self::$hierarchyPermissionsCache[$cacheKey])) {
            $permissionSets = collect();

            // Public permissions (group_id and role_id are null)
            $publicPerms = $hierarchy->hierarchyPermissions->whereNull('group_id')->whereNull('role_id')->first();
            if ($publicPerms) {
                $permissionSets->push($publicPerms->permissions);
            }

            if ($user) {
                // Group permissions
                $userGroupIds = self::getUserGroupIds($user, $faction->id);
                $groupPerms = $hierarchy->hierarchyPermissions->whereIn('group_id', $userGroupIds);
                foreach ($groupPerms as $gp) {
                    $permissionSets->push($gp->permissions);
                }

                // Role permissions
                $userRoleIds = self::getUserRoleIds($user, $faction->id);
                $rolePerms = $hierarchy->hierarchyPermissions->whereIn('role_id', $userRoleIds);
                foreach ($rolePerms as $rp) {
                    $permissionSets->push($rp->permissions);
                }
            }

            $resolved = [];
            foreach ($permissionSets as $set) {
                if (is_array($set)) {
                    foreach ($set as $perm) {
                        $resolved[] = $perm;
                    }
                }
            }
            self::$hierarchyPermissionsCache[$cacheKey] = array_unique($resolved);
        }

        return in_array($permissionKey, self::$hierarchyPermissionsCache[$cacheKey]);
    }

    public static function canViewHierarchy(?User $user, Hierarchy $hierarchy): bool
    {
        if ($user && $user->is_superadmin) {
            return true;
        }

        $faction = $hierarchy->faction;
        if ($user && $faction->faction_leader === $user->id) {
            return true;
        }

        if ($user && self::hasFactionPermission($user, $faction, 'global_hierarchy_moderation')) {
            return true;
        }

        if ($user && $hierarchy->created_by === $user->id) {
            return true;
        }

        $hasExplicitPerms = $hierarchy->hierarchyPermissions->isNotEmpty();
        if ($hasExplicitPerms) {
            return self::hasHierarchyPermission($user, $hierarchy, 'view_hierarchy');
        }

        $canViewGlobal = $user && self::hasFactionPermission($user, $faction, 'view_faction_hierarchy');

        return $canViewGlobal || self::hasHierarchyPermission($user, $hierarchy, 'view_hierarchy');
    }

    public static function hasRecordPermission(?User $user, FactionRecordDatabase $database, string $permissionKey): bool
    {
        $faction = $database->faction;

        // 1. Superadmin/Faction Leader/Global Record Moderator/Creator always have access
        if ($user) {
            if ($user->is_superadmin ||
                $faction->faction_leader === $user->id ||
                self::hasFactionPermission($user, $faction, 'global_faction_record_moderation') ||
                $database->created_by === $user->id
            ) {
                return true;
            }
        }

        $userId = $user ? $user->id : 'guest';
        $cacheKey = "{$userId}_{$database->id}";

        if (! isset(self::$recordPermissionsCache[$cacheKey])) {
            $permissionSets = collect();

            // Public permissions (group_id and role_id are null)
            $publicPerms = $database->databasePermissions->whereNull('group_id')->whereNull('role_id')->first();
            if ($publicPerms) {
                $permissionSets->push($publicPerms->permissions);
            }

            if ($user) {
                // Group permissions
                $userGroupIds = self::getUserGroupIds($user, $faction->id);
                $groupPerms = $database->databasePermissions->whereIn('group_id', $userGroupIds);
                foreach ($groupPerms as $gp) {
                    $permissionSets->push($gp->permissions);
                }

                // Role permissions
                $userRoleIds = self::getUserRoleIds($user, $faction->id);
                $rolePerms = $database->databasePermissions->whereIn('role_id', $userRoleIds);
                foreach ($rolePerms as $rp) {
                    $permissionSets->push($rp->permissions);
                }
            }

            $resolved = [];
            foreach ($permissionSets as $set) {
                if (is_array($set)) {
                    foreach ($set as $perm) {
                        $resolved[] = $perm;
                    }
                }
            }
            self::$recordPermissionsCache[$cacheKey] = array_unique($resolved);
        }

        return in_array($permissionKey, self::$recordPermissionsCache[$cacheKey]);
    }

    public static function hasStatisticsPermission(?User $user, StatisticsModel $model, string $permissionKey): bool
    {
        $faction = $model->faction;

        // 1. Superadmin/Faction Leader/Global Statistics Moderator/Creator always have access
        if ($user) {
            if ($user->is_superadmin ||
                $faction->faction_leader === $user->id ||
                self::hasFactionPermission($user, $faction, 'global_statistics_moderation') ||
                $model->created_by === $user->id
            ) {
                return true;
            }
        }

        $userId = $user ? $user->id : 'guest';
        $cacheKey = "{$userId}_{$model->id}";

        if (! isset(self::$statisticsPermissionsCache[$cacheKey])) {
            $permissionSets = collect();

            // Public permissions (group_id and role_id are null)
            $publicPerms = $model->statisticsPermissions->whereNull('group_id')->whereNull('role_id')->first();
            if ($publicPerms) {
                $permissionSets->push($publicPerms->permissions);
            }

            if ($user) {
                // Group permissions
                $userGroupIds = self::getUserGroupIds($user, $faction->id);
                $groupPerms = $model->statisticsPermissions->whereIn('group_id', $userGroupIds);
                foreach ($groupPerms as $gp) {
                    $permissionSets->push($gp->permissions);
                }

                // Role permissions
                $userRoleIds = self::getUserRoleIds($user, $faction->id);
                $rolePerms = $model->statisticsPermissions->whereIn('role_id', $userRoleIds);
                foreach ($rolePerms as $rp) {
                    $permissionSets->push($rp->permissions);
                }
            }

            $resolved = [];
            foreach ($permissionSets as $set) {
                if (is_array($set)) {
                    foreach ($set as $perm) {
                        $resolved[] = $perm;
                    }
                }
            }
            self::$statisticsPermissionsCache[$cacheKey] = array_unique($resolved);
        }

        return in_array($permissionKey, self::$statisticsPermissionsCache[$cacheKey]);
    }

    public static function hasFormPermission(?User $user, Form $form, string $permissionKey): bool
    {
        $faction = $form->faction;

        // 1. Superadmin/Faction Leader/Global Form Moderator/Creator always have access
        if ($user) {
            if ($user->is_superadmin ||
                $faction->faction_leader === $user->id ||
                self::hasFactionPermission($user, $faction, 'global_faction_form_moderation') ||
                $form->created_by === $user->id
            ) {
                return true;
            }
        }

        $userId = $user ? $user->id : 'guest';
        $cacheKey = "{$userId}_{$form->id}";

        if (! isset(self::$formPermissionsCache[$cacheKey])) {
            $permissionSets = collect();

            // Public permissions (group_id and role_id are null)
            $publicPerms = $form->formPermissions->whereNull('group_id')->whereNull('role_id')->first();
            if ($publicPerms) {
                $permissionSets->push($publicPerms->permissions);
            }

            if ($user) {
                // Group permissions
                $userGroupIds = self::getUserGroupIds($user, $faction->id);
                $groupPerms = $form->formPermissions->whereIn('group_id', $userGroupIds);
                foreach ($groupPerms as $gp) {
                    $permissionSets->push($gp->permissions);
                }

                // Role permissions
                $userRoleIds = self::getUserRoleIds($user, $faction->id);
                $rolePerms = $form->formPermissions->whereIn('role_id', $userRoleIds);
                foreach ($rolePerms as $rp) {
                    $permissionSets->push($rp->permissions);
                }
            }

            $resolved = [];
            foreach ($permissionSets as $set) {
                if (is_array($set)) {
                    foreach ($set as $perm) {
                        $resolved[] = $perm;
                    }
                }
            }
            self::$formPermissionsCache[$cacheKey] = array_unique($resolved);
        }

        return in_array($permissionKey, self::$formPermissionsCache[$cacheKey]);
    }
}
