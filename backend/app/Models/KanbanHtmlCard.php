<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class KanbanHtmlCard extends Model
{
    use Auditable, SoftDeletes;

    protected $table = 'kanban_html_cards';

    protected $fillable = [
        'project_id',
        'status_id',
        'name',
        'content',
        'position',
        'order',
        'created_by',
    ];

    protected $casts = [
        'order' => 'integer',
    ];

    protected $attributes = [
        'position' => 'top',
        'order' => 0,
    ];

    public function project()
    {
        return $this->belongsTo(KanbanProject::class, 'project_id');
    }

    public function status()
    {
        return $this->belongsTo(KanbanStatus::class, 'status_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
