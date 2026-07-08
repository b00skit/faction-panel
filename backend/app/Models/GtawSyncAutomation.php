<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GtawSyncAutomation extends Model
{
    use HasFactory;

    protected $fillable = [
        'faction_id',
        'enabled',
        'frequency',
        'time_of_day',
        'next_run_at',
        'last_run_at',
        'created_by',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'next_run_at' => 'datetime',
        'last_run_at' => 'datetime',
    ];

    public function faction()
    {
        return $this->belongsTo(Faction::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function calculateNextRunAt($from = null): Carbon
    {
        $from = $from ? Carbon::parse($from) : now();
        $timeOfDay = $this->time_of_day ?: '00:00';

        // Parse hour and minute
        [$hour, $minute] = explode(':', $timeOfDay);

        // Determine interval hours based on frequency
        $intervalHours = match ($this->frequency) {
            'twice_daily' => 12,
            'every_8_hours' => 8,
            'every_6_hours' => 6,
            'every_4_hours' => 4,
            'every_2_hours' => 2,
            'hourly' => 1,
            default => 24, // daily
        };

        // Create base time today at configured time_of_day
        $base = $from->copy()->setTime($hour, $minute, 0);

        // If base time is in the future, subtract 24 hours until it's in the past or equal to now
        while ($base->greaterThan($from)) {
            $base->subDay();
        }

        // Add interval hours repeatedly until the result is in the future
        $next = $base->copy();
        while ($next->lessThanOrEqualTo($from)) {
            $next->addHours($intervalHours);
        }

        return $next;
    }
}
