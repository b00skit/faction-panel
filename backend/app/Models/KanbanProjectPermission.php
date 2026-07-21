<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KanbanProjectPermission extends Model
{
    protected $fillable = [
        'project_id',
        'group_id',
        'role_id',
        'permissions',
    ];

    protected $casts = [
        'permissions' => 'array',
    ];

    public function project()
    {
        return $this->belongsTo(KanbanProject::class, 'project_id');
    }

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }
}
