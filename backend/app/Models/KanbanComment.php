<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KanbanComment extends Model
{
    protected $fillable = [
        'card_id',
        'user_id',
        'comment',
    ];

    public function card()
    {
        return $this->belongsTo(KanbanCard::class, 'card_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
