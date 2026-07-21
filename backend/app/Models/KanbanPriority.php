<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class KanbanPriority extends Model
{
    use Auditable, SoftDeletes;

    protected $fillable = [
        'name',
        'color',
        'icon',
        'order',
        'is_default',
    ];

    protected $casts = [
        'is_default' => 'boolean',
    ];
}
