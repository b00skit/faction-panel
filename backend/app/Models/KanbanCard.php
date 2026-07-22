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
        'row_id',
        'card_type_id',
        'priority_id',
        'title',
        'description',
        'color',
        'order',
        'count',
        'created_by',
        'is_archived',
    ];

    protected $casts = [
        'count' => 'integer',
        'is_archived' => 'boolean',
    ];

    protected $attributes = [
        'is_archived' => false,
    ];

    protected static function booted()
    {
        static::creating(function ($card) {
            if (is_null($card->count)) {
                $maxCount = static::withTrashed()
                    ->where('project_id', $card->project_id)
                    ->max('count') ?? 0;
                $card->count = $maxCount + 1;
            }
        });

        static::retrieved(function ($card) {
            if (is_null($card->count)) {
                $count = static::withTrashed()
                    ->where('project_id', $card->project_id)
                    ->where('id', '<=', $card->id)
                    ->count();
                $card->count = $count > 0 ? $count : 1;
                $card->saveQuietly();
            }
        });
    }

    public function project()
    {
        return $this->belongsTo(KanbanProject::class, 'project_id');
    }

    public function status()
    {
        return $this->belongsTo(KanbanStatus::class, 'status_id');
    }

    public function row()
    {
        return $this->belongsTo(KanbanRow::class, 'row_id');
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
