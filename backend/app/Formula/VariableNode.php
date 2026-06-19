<?php

namespace App\Formula;

class VariableNode extends ASTNode
{
    private string $name;

    public function __construct(string $name)
    {
        $this->name = $name;
    }

    public function evaluate(EvaluationContext $context): mixed
    {
        return $context->getVariable($this->name);
    }
}
