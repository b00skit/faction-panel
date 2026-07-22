<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class KanbanProject extends Model
{
    use Auditable, SoftDeletes;

    protected $fillable = [
        'faction_id',
        'name',
        'color',
        'description',
        'order',
        'created_by',
        'prefix',
        'show_prefix',
        'enable_project_management',
    ];

    protected $casts = [
        'show_prefix' => 'boolean',
        'enable_project_management' => 'boolean',
    ];

    protected $attributes = [
        'show_prefix' => true,
        'enable_project_management' => false,
    ];

    public function faction()
    {
        return $this->belongsTo(Faction::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function statuses()
    {
        return $this->hasMany(KanbanStatus::class, 'project_id')->orderBy('order')->orderBy('id');
    }

    public function rows()
    {
        return $this->hasMany(KanbanRow::class, 'project_id')->orderBy('order')->orderBy('id');
    }

    public function labels()
    {
        return $this->hasMany(KanbanLabel::class, 'project_id');
    }

    public function cards()
    {
        return $this->hasMany(KanbanCard::class, 'project_id');
    }

    public function permissions()
    {
        return $this->hasMany(KanbanProjectPermission::class, 'project_id');
    }

    public function resolveRouteBinding($value, $field = null)
    {
        return $this->where('id', $value)
            ->orWhere('prefix', $value)
            ->first();
    }
}
