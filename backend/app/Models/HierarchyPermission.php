<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HierarchyPermission extends Model
{
    protected $fillable = [
        'hierarchy_id',
        'group_id',
        'role_id',
        'permissions',
    ];

    protected $casts = [
        'permissions' => 'array',
    ];

    public function hierarchy()
    {
        return $this->belongsTo(Hierarchy::class);
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
