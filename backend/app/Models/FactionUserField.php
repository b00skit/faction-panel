<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FactionUserField extends Model
{
    use Auditable, HasFactory;

    protected $fillable = [
        'faction_id',
        'name',
        'type',
        'is_featured',
    ];

    protected $casts = [
        'is_featured' => 'boolean',
    ];

    public function faction()
    {
        return $this->belongsTo(Faction::class);
    }

    public function values()
    {
        return $this->hasMany(FactionUserFieldValue::class, 'faction_user_field_id');
    }
}
