<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Group extends Model
{
    use Auditable, SoftDeletes;

    protected $fillable = [
        'faction_id',
        'name',
        'color',
        'created_by',
    ];

    public function faction()
    {
        return $this->belongsTo(Faction::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function members()
    {
        return $this->belongsToMany(User::class)->withPivot('is_leader')->withTimestamps();
    }

    public function users()
    {
        return $this->members();
    }

    public function leaders()
    {
        return $this->belongsToMany(User::class)->wherePivot('is_leader', true)->withPivot('is_leader')->withTimestamps();
    }
}
