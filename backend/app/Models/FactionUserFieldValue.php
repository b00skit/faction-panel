<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FactionUserFieldValue extends Model
{
    use Auditable, HasFactory;

    protected $fillable = [
        'user_id',
        'faction_user_field_id',
        'value',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function field()
    {
        return $this->belongsTo(FactionUserField::class, 'faction_user_field_id');
    }
}
