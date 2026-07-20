<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class KanbanStatus extends Model
{
    use Auditable, SoftDeletes;

    protected $table = 'kanban_statuses';

    protected $fillable = [
        'project_id',
        'name',
        'order',
    ];

    public function project()
    {
        return $this->belongsTo(KanbanProject::class, 'project_id');
    }

    public function cards()
    {
        return $this->hasMany(KanbanCard::class, 'status_id')->orderBy('order')->orderBy('id');
    }
}
