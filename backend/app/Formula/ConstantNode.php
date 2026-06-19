<?php

namespace App\Formula;

class ConstantNode extends ASTNode
{
    private mixed $value;

    public function __construct(mixed $value)
    {
        $this->value = $value;
    }

    public function evaluate(EvaluationContext $context): mixed
    {
        return $this->value;
    }
}
