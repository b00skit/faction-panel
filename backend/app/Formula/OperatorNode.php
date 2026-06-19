<?php

namespace App\Formula;

class OperatorNode extends ASTNode
{
    private string $operator;
    private ASTNode $left;
    private ASTNode $right;

    public function __construct(string $operator, ASTNode $left, ASTNode $right)
    {
        $this->operator = $operator;
        $this->left = $left;
        $this->right = $right;
    }

    public function evaluate(EvaluationContext $context): mixed
    {
        $lVal = $this->left->evaluate($context);
        $rVal = $this->right->evaluate($context);

        switch ($this->operator) {
            case '+': return (float)$lVal + (float)$rVal;
            case '-': return (float)$lVal - (float)$rVal;
            case '*': return (float)$lVal * (float)$rVal;
            case '/':
                $divisor = (float)$rVal;
                if ($divisor === 0.0) {
                    return 0.0;
                }
                return (float)$lVal / $divisor;
            default:
                throw new \Exception("Unsupported operator: " . $this->operator);
        }
    }
}
