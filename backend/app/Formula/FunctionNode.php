<?php

namespace App\Formula;

class FunctionNode extends ASTNode
{
    private string $name;
    private array $arguments;

    public function __construct(string $name, array $arguments)
    {
        $this->name = $name;
        $this->arguments = $arguments;
    }

    public function evaluate(EvaluationContext $context): mixed
    {
        $evaluatedArgs = [];
        foreach ($this->arguments as $arg) {
            $evaluatedArgs[] = $arg->evaluate($context);
        }
        return $context->callFunction($this->name, $evaluatedArgs);
    }
}
