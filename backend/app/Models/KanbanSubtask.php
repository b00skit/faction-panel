<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KanbanSubtask extends Model
{
    protected $fillable = [
        'card_id',
        'title',
        'is_completed',
        'order',
    ];

    protected $casts = [
        'is_completed' => 'boolean',
    ];

    public function card()
    {
        return $this->belongsTo(KanbanCard::class, 'card_id');
    }
}
