<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class FactionRecordDatabase extends Model
{
    use Auditable, SoftDeletes;

    protected $fillable = [
        'faction_id',
        'name',
        'description',
        'allow_details_view',
        'data_overview_display',
        'data_entry_display',
        'record_shortcode',
        'permissions',
        'database_structure',
        'detail_customization',
        'is_api_database',
        'is_published',
        'created_by',
    ];

    protected $casts = [
        'permissions' => 'array',
        'database_structure' => 'array',
        'detail_customization' => 'array',
        'is_api_database' => 'boolean',
        'allow_details_view' => 'boolean',
        'is_published' => 'boolean',
    ];

    protected $appends = [
        'api_database_type',
    ];

    public function getApiDatabaseTypeAttribute()
    {
        $raw = $this->getRawOriginal('is_api_database');

        return ($raw && $raw !== '0') ? $raw : null;
    }

    public static function resolveDatabaseId($identifier, $factionDatabases): ?int
    {
        if (! $identifier) {
            return null;
        }
        if (is_numeric($identifier)) {
            $idVal = (int) $identifier;
            $matched = $factionDatabases->firstWhere('id', $idVal);
            if ($matched) {
                return $matched->id;
            }
        }

        $strIdentifier = (string) $identifier;

        // 1. Check by is_api_database
        $matched = $factionDatabases->first(function ($db) use ($strIdentifier) {
            $raw = $db->getRawOriginal('is_api_database') ?: $db->is_api_database;

            return is_string($raw) && strcasecmp($raw, $strIdentifier) === 0;
        });
        if ($matched) {
            return $matched->id;
        }

        // 2. Check by record_shortcode
        $matched = $factionDatabases->first(function ($db) use ($strIdentifier) {
            return strcasecmp((string) $db->record_shortcode, $strIdentifier) === 0;
        });
        if ($matched) {
            return $matched->id;
        }

        // 3. Check API type map
        $apiTypeMap = [
            'CHARS' => 'gtaw_characters',
            'ACTIVITY' => 'gtaw_activity',
            'CHIST' => 'gtaw_history',
            'CNAME' => 'gtaw_name_changes',
        ];
        if (isset($apiTypeMap[$strIdentifier])) {
            $targetType = $apiTypeMap[$strIdentifier];
            $matched = $factionDatabases->first(function ($db) use ($targetType) {
                $raw = $db->getRawOriginal('is_api_database') ?: $db->is_api_database;

                return is_string($raw) && strcasecmp($raw, $targetType) === 0;
            });
            if ($matched) {
                return $matched->id;
            }
        }

        return null;
    }

    public function faction()
    {
        return $this->belongsTo(Faction::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by')->withDefault([
            'username' => 'System',
        ]);
    }

    public function entries()
    {
        return $this->hasMany(FactionRecordEntry::class, 'database_id');
    }

    public function databasePermissions()
    {
        return $this->hasMany(FactionRecordDatabasePermission::class, 'database_id');
    }
}
