# math.calculate
Compute explicit arithmetic locally. Input: {"expression":"(1200 + 800) / 4"}.
Supports decimal/scientific numbers, parentheses, unary signs, + - * / × ÷.
Uses finite IEEE-754 binary64 arithmetic, not exact financial decimal arithmetic.
No JavaScript evaluation, variables, units, percentages, filesystem or network access.
Reject invalid expressions, division by zero, excessive nesting and nonfinite results.
Results and the exact expression are retained in the normal activity record; no automatic note writes.
