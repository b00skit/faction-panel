<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class KanbanLabel extends Model
{
    use Auditable, SoftDeletes;

    protected $fillable = [
        'project_id',
        'name',
        'color',
    ];

    public function project()
    {
        return $this->belongsTo(KanbanProject::class, 'project_id');
    }

    public function cards()
    {
        return $this->belongsToMany(KanbanCard::class, 'kanban_card_label', 'label_id', 'card_id');
    }
}
