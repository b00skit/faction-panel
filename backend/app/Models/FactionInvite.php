<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FactionInvite extends Model
{
    use HasFactory;

    protected $fillable = [
        'faction_id',
        'code',
        'expires_at',
        'max_uses',
        'uses',
        'role_id',
        'created_by',
        'field_values',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'field_values' => 'array',
    ];

    public function faction()
    {
        return $this->belongsTo(Faction::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    public function groups()
    {
        return $this->belongsToMany(Group::class, 'faction_invite_group');
    }

    public function isExpired()
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    public function isFull()
    {
        return $this->max_uses && $this->uses >= $this->max_uses;
    }

    public function isValid()
    {
        return ! $this->isExpired() && ! $this->isFull();
    }
}
