<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GtawSyncLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'faction_id',
        'trigger_type',
        'user_id',
        'status',
        'results',
        'error',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'results' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function faction()
    {
        return $this->belongsTo(Faction::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
