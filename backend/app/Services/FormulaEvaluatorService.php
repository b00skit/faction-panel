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

    /**
     * Helper to resolve property value on an item using EvaluationContext.
     */
    public function getPropertyVal(mixed $item, string $property): mixed
    {
        $factionId = 0;
        if (is_object($item) && isset($item->faction_id)) {
            $factionId = $item->faction_id;
        } elseif (is_object($item) && method_exists($item, 'faction')) {
            $factionId = $item->faction()->first()?->id ?? 0;
        }

        $context = new EvaluationContext($factionId);
        return $context->getPropertyVal($item, $property);
    }

    /**
     * Convert data to a Collection using EvaluationContext.
     */
    public function toCollection(mixed $data): \Illuminate\Support\Collection
    {
        $context = new EvaluationContext(0);
        return $context->toCollection($data);
    }
}
