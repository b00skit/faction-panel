<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class FactionPage extends Model
{
    use Auditable, HasFactory, SoftDeletes;

    protected $fillable = [
        'faction_id',
        'name',
        'slug',
        'icon',
        'show_in_sidebar',
        'content',
        'sort_order',
        'is_published',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'show_in_sidebar' => 'boolean',
        'is_published' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function faction()
    {
        return $this->belongsTo(Faction::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function permissions()
    {
        return $this->hasMany(FactionPagePermission::class, 'page_id');
    }
}
