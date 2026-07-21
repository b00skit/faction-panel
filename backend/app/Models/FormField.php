<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FormField extends Model
{
    use HasFactory;

    protected $fillable = [
        'form_section_id',
        'type',
        'label',
        'description',
        'name',
        'options',
        'validation_rules',
        'order',
        'points',
        'is_required',
        'has_grading',
        'is_automatic_scored',
        'correct_answer',
        'prefill_type',
        'default_value',
        'is_disabled',
        'placeholder',
        'is_multi',
        'width',
    ];

    protected $hidden = [
        'correct_answer',
    ];

    protected $casts = [
        'options' => 'array',
        'validation_rules' => 'array',
        'is_required' => 'boolean',
        'has_grading' => 'boolean',
        'is_automatic_scored' => 'boolean',
        'points' => 'integer',
        'order' => 'integer',
        'is_disabled' => 'boolean',
        'is_multi' => 'boolean',
        'width' => 'integer',
    ];

    public function section()
    {
        return $this->belongsTo(FormSection::class, 'form_section_id');
    }

    public function responses()
    {
        return $this->hasMany(FormResponse::class);
    }
}
