<?php

namespace App\Services;

use App\Formula\Lexer;
use App\Formula\Parser;
use App\Formula\EvaluationContext;

class FormulaEvaluatorService
{
    /**
     * Tokenize, parse, and evaluate a formula string within a faction context.
     *
     * @param string $formula
     * @param int $factionId
     * @param array $variables
     * @return mixed
     * @throws \Exception
     */
    public function evaluate(string $formula, int $factionId, array $variables = []): mixed
    {
        $formula = trim($formula);
        if ($formula === '') {
            return 0.0;
        }

        $lexer = new Lexer($formula);
        $tokens = $lexer->tokenize();

        $parser = new Parser($tokens);
        $ast = $parser->parse();

        $context = new EvaluationContext($factionId, $variables);
        return $ast->evaluate($context);
    }
}
