<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class KanbanRow extends Model
{
    use Auditable, SoftDeletes;

    protected $table = 'kanban_rows';

    protected $fillable = [
        'project_id',
        'name',
        'order',
        'is_visible',
        'is_default',
    ];

    protected $casts = [
        'is_visible' => 'boolean',
        'is_default' => 'boolean',
    ];

    protected $attributes = [
        'is_visible' => true,
        'is_default' => false,
    ];

    public function project()
    {
        return $this->belongsTo(KanbanProject::class, 'project_id');
    }

    public function cards()
    {
        return $this->hasMany(KanbanCard::class, 'row_id')->where('is_archived', false)->orderBy('order')->orderBy('id');
    }
}
