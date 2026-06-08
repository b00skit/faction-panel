<?php

namespace App\Models;

use App\Traits\Auditable;
use Database\Factories\FactionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class Faction extends Model
{
    /** @use HasFactory<FactionFactory> */
    use Auditable, HasFactory, SoftDeletes;

    protected $appends = ['allow_branding'];

    public function getAllowBrandingAttribute(): bool
    {
        return $this->creator ? $this->creator->allow_custom_branding : false;
    }

    protected function getImageUrlAttribute($value)
    {
        return $this->resolveBrandingUrl($value);
    }

    protected function setImageUrlAttribute($value)
    {
        $this->attributes['image_url'] = $this->stripStorageUrl($value);
    }

    protected function getHeaderImageDarkAttribute($value)
    {
        return $this->resolveBrandingUrl($value);
    }

    protected function setHeaderImageDarkAttribute($value)
    {
        $this->attributes['header_image_dark'] = $this->stripStorageUrl($value);
    }

    protected function getHeaderImageLightAttribute($value)
    {
        return $this->resolveBrandingUrl($value);
    }

    protected function setHeaderImageLightAttribute($value)
    {
        $this->attributes['header_image_light'] = $this->stripStorageUrl($value);
    }

    protected function getFaviconAttribute($value)
    {
        return $this->resolveBrandingUrl($value);
    }

    protected function setFaviconAttribute($value)
    {
        $this->attributes['favicon'] = $this->stripStorageUrl($value);
    }

    private function resolveBrandingUrl($value)
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

    private function stripStorageUrl($value)
    {
        if (! $value) {
            return null;
        }

        // Try both possible bases
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

    protected $fillable = [
        'shortname',
        'name',
        'description',
        'color',
        'image_url',
        'header_image_dark',
        'header_image_light',
        'favicon',
        'header_link_to_faction',
        'hide_panel_header',
        'custom_footer_text',
        'header_bg_color',
        'header_gradient_enabled',
        'header_gradient_color',
        'header_gradient_direction',
        'visibility',
        'access',
        'gtaw_faction_id',
        'faction_leader',
        'roster_template',
        'quick_search_enabled',
        'quick_search_settings',
        'created_by',
    ];

    protected $casts = [
        'roster_template' => 'array',
        'quick_search_enabled' => 'boolean',
        'quick_search_settings' => 'array',
    ];

    protected static function boot()
    {
        parent::boot();

        static::deleting(function ($faction) {
            // When soft deleting, we want to "free up" the unique constraints
            // so a user can create a new faction with the same name or link the same GTAW ID.
            if (! $faction->isForceDeleting()) {
                $now = now()->timestamp;
                $faction->shortname = $faction->shortname.'::deleted_'.$now;
                $faction->gtaw_faction_id = null; // Setting to null frees up the unique integer constraint
                $faction->save();
            }
        });
    }

    public function invites()
    {
        return $this->hasMany(FactionInvite::class);
    }

    public function users()
    {
        return $this->belongsToMany(User::class)
            ->withPivot('current_roster_id', 'last_roster_activity')
            ->withTimestamps();
    }

    public function leader()
    {
        return $this->belongsTo(User::class, 'faction_leader');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function roles()
    {
        return $this->hasMany(Role::class);
    }

    public function rosters()
    {
        return $this->hasMany(Roster::class);
    }

    public function hierarchies()
    {
        return $this->hasMany(Hierarchy::class);
    }

    public function forms()
    {
        return $this->hasMany(Form::class);
    }

    public function recordDatabases()
    {
        return $this->hasMany(FactionRecordDatabase::class);
    }

    public function groups()
    {
        return $this->hasMany(Group::class);
    }

    public function rosterFlags()
    {
        return $this->hasMany(RosterFlag::class);
    }

    public function rosterDatasets()
    {
        return $this->hasMany(RosterDataset::class);
    }

    public function statisticsModels()
    {
        return $this->hasMany(StatisticsModel::class);
    }
}
