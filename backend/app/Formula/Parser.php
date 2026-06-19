<?php

namespace App\Formula;

class Parser
{
    private array $tokens;
    private int $pos = 0;

    public function __construct(array $tokens)
    {
        $this->tokens = $tokens;
    }

    private function current(): Token
    {
        return $this->tokens[$this->pos];
    }

    private function consume(string $type): Token
    {
        $tok = $this->current();
        if ($tok->type !== $type) {
            throw new \Exception("Expected token type {$type}, got {$tok->type} with value '" . ($tok->value ?? '') . "'");
        }
        $this->pos++;
        return $tok;
    }

    public function parse(): ASTNode
    {
        $node = $this->parseExpression();
        if ($this->current()->type !== Token::TYPE_EOF) {
            throw new \Exception("Unexpected token at end of formula: " . ($this->current()->value ?? $this->current()->type));
        }
        return $node;
    }

    private function parseExpression(): ASTNode
    {
        return $this->parseAddition();
    }

    private function parseAddition(): ASTNode
    {
        $left = $this->parseMultiplication();
        while ($this->current()->type === Token::TYPE_OPERATOR && in_array($this->current()->value, ['+', '-'], true)) {
            $op = $this->consume(Token::TYPE_OPERATOR)->value;
            $right = $this->parseMultiplication();
            $left = new OperatorNode($op, $left, $right);
        }
        return $left;
    }

    private function parseMultiplication(): ASTNode
    {
        $left = $this->parsePrimary();
        while ($this->current()->type === Token::TYPE_OPERATOR && in_array($this->current()->value, ['*', '/'], true)) {
            $op = $this->consume(Token::TYPE_OPERATOR)->value;
            $right = $this->parsePrimary();
            $left = new OperatorNode($op, $left, $right);
        }
        return $left;
    }

    private function parsePrimary(): ASTNode
    {
        $tok = $this->current();

        if ($tok->type === Token::TYPE_NUMBER) {
            $this->consume(Token::TYPE_NUMBER);
            return new ConstantNode($tok->value);
        }

        if ($tok->type === Token::TYPE_STRING) {
            $this->consume(Token::TYPE_STRING);
            return new ConstantNode($tok->value);
        }

        if ($tok->type === Token::TYPE_IDENTIFIER) {
            $name = $this->consume(Token::TYPE_IDENTIFIER)->value;
            // Check if it's a function call
            if ($this->current()->type === Token::TYPE_LPAREN) {
                $this->consume(Token::TYPE_LPAREN);
                $args = [];
                if ($this->current()->type !== Token::TYPE_RPAREN) {
                    $args[] = $this->parseExpression();
                    while ($this->current()->type === Token::TYPE_COMMA) {
                        $this->consume(Token::TYPE_COMMA);
                        $args[] = $this->parseExpression();
                    }
                }
                $this->consume(Token::TYPE_RPAREN);
                return new FunctionNode($name, $args);
            }

            // Otherwise, it's a constant identifier like true, false, null
            $lowerName = strtolower($name);
            if ($lowerName === 'true') {
                return new ConstantNode(true);
            }
            if ($lowerName === 'false') {
                return new ConstantNode(false);
            }
            if ($lowerName === 'null') {
                return new ConstantNode(null);
            }

            return new VariableNode($name);
        }

        if ($tok->type === Token::TYPE_LPAREN) {
            $this->consume(Token::TYPE_LPAREN);
            $expr = $this->parseExpression();
            $this->consume(Token::TYPE_RPAREN);
            return $expr;
        }

        throw new \Exception("Unexpected token in primary expression: " . ($tok->value ?? $tok->type));
    }
}
