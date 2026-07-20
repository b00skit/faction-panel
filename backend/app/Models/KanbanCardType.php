<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class KanbanCardType extends Model
{
    use Auditable, SoftDeletes;

    protected $fillable = [
        'name',
        'color',
        'icon',
        'settings',
    ];

    protected $casts = [
        'settings' => 'array',
    ];
}
