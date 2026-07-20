<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class KanbanCard extends Model
{
    use Auditable, SoftDeletes;

    protected $fillable = [
        'project_id',
        'status_id',
        'card_type_id',
        'priority_id',
        'title',
        'description',
        'color',
        'order',
        'created_by',
    ];

    public function project()
    {
        return $this->belongsTo(KanbanProject::class, 'project_id');
    }

    public function status()
    {
        return $this->belongsTo(KanbanStatus::class, 'status_id');
    }

    public function cardType()
    {
        return $this->belongsTo(KanbanCardType::class, 'card_type_id');
    }

    public function priority()
    {
        return $this->belongsTo(KanbanPriority::class, 'priority_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignees()
    {
        return $this->belongsToMany(User::class, 'kanban_card_assignee', 'card_id', 'user_id');
    }

    public function labels()
    {
        return $this->belongsToMany(KanbanLabel::class, 'kanban_card_label', 'card_id', 'label_id');
    }

    public function subtasks()
    {
        return $this->hasMany(KanbanSubtask::class, 'card_id')->orderBy('order')->orderBy('id');
    }

    public function comments()
    {
        return $this->hasMany(KanbanComment::class, 'card_id')->orderBy('created_at', 'desc');
    }
}
