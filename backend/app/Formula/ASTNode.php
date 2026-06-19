<?php

namespace App\Formula;

abstract class ASTNode
{
    abstract public function evaluate(EvaluationContext $context): mixed;
}
