# math.calculate
Compute explicit arithmetic locally. Input: {"expression":"(1200 + 800) / 4"}.
Supports decimal/scientific numbers, parentheses, unary signs, + - * / × ÷.
Uses bounded decimal arithmetic; results are strings. Non-terminating division is rounded to 18 decimal places using ties-to-even and reports rounded=true. Terminating decimals remain exact within bounds.
No JavaScript evaluation, variables, units, percentages, filesystem or network access.
Reject invalid expressions, division by zero, excessive nesting and nonfinite results.
Results and the exact expression are retained in the normal activity record; no automatic note writes.
