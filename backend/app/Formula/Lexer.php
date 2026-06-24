<?php

namespace App\Formula;

class Lexer
{
    private string $input;

    private int $pos = 0;

    private int $len = 0;

    public function __construct(string $input)
    {
        $this->input = $input;
        $this->len = strlen($input);
    }

    public function tokenize(): array
    {
        $tokens = [];
        while ($this->pos < $this->len) {
            $char = $this->input[$this->pos];

            if (ctype_space($char)) {
                $this->pos++;

                continue;
            }

            if ($char === '(') {
                $tokens[] = new Token(Token::TYPE_LPAREN, '(');
                $this->pos++;

                continue;
            }

            if ($char === ')') {
                $tokens[] = new Token(Token::TYPE_RPAREN, ')');
                $this->pos++;

                continue;
            }

            if ($char === ',') {
                $tokens[] = new Token(Token::TYPE_COMMA, ',');
                $this->pos++;

                continue;
            }

            if (in_array($char, ['+', '-', '*', '/'], true)) {
                $tokens[] = new Token(Token::TYPE_OPERATOR, $char);
                $this->pos++;

                continue;
            }

            // String literals (single or double quotes)
            if ($char === '"' || $char === "'") {
                $quote = $char;
                $val = '';
                $this->pos++;
                while ($this->pos < $this->len && $this->input[$this->pos] !== $quote) {
                    if ($this->input[$this->pos] === '\\' && $this->pos + 1 < $this->len) {
                        $this->pos++;
                    }
                    $val .= $this->input[$this->pos];
                    $this->pos++;
                }
                if ($this->pos >= $this->len) {
                    throw new \Exception('Unterminated string literal');
                }
                $this->pos++; // skip closing quote
                $tokens[] = new Token(Token::TYPE_STRING, $val);

                continue;
            }

            // Number literals
            if (ctype_digit($char) || $char === '.') {
                $val = '';
                while ($this->pos < $this->len && (ctype_digit($this->input[$this->pos]) || $this->input[$this->pos] === '.')) {
                    $val .= $this->input[$this->pos];
                    $this->pos++;
                }
                $tokens[] = new Token(Token::TYPE_NUMBER, (float) $val);

                continue;
            }

            // Identifiers / Functions
            if (ctype_alpha($char) || $char === '_') {
                $val = '';
                while ($this->pos < $this->len && (ctype_alnum($this->input[$this->pos]) || $this->input[$this->pos] === '_')) {
                    $val .= $this->input[$this->pos];
                    $this->pos++;
                }
                $tokens[] = new Token(Token::TYPE_IDENTIFIER, $val);

                continue;
            }

            throw new \Exception('Unexpected character: '.$char);
        }
        $tokens[] = new Token(Token::TYPE_EOF);

        return $tokens;
    }
}
