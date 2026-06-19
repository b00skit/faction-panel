<?php

namespace App\Formula;

class Token
{
    public const TYPE_IDENTIFIER = 'IDENTIFIER';
    public const TYPE_STRING = 'STRING';
    public const TYPE_NUMBER = 'NUMBER';
    public const TYPE_LPAREN = 'LPAREN';
    public const TYPE_RPAREN = 'RPAREN';
    public const TYPE_COMMA = 'COMMA';
    public const TYPE_OPERATOR = 'OPERATOR';
    public const TYPE_EOF = 'EOF';

    public string $type;
    public mixed $value;

    public function __construct(string $type, mixed $value = null)
    {
        $this->type = $type;
        $this->value = $value;
    }
}
