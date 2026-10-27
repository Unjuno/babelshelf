# Decimal calculation transition

Status: a standalone bounded decimal evaluator and its Node tests exist; it is
not connected to the product, tool registry or receipt verification. Existing calculations use finite
IEEE-754 binary64, including their tool result and independent receipt checks.
The existing calculator must remain available to validate historical records.

## User-visible contract

- Decimal literals are interpreted as decimal values, including scientific
  notation. Parentheses and unary signs retain their current meaning.
- Addition, subtraction and multiplication are exact within bounded resource
  limits. Division that terminates in base ten is exact within those limits.
- A non-terminating division requires an explicitly defined precision and
  rounding rule; the displayed value must identify that it is rounded. Never
  silently truncate or present a rounded result as exact.
- A calculation beyond supported input, intermediate-size or output limits
  fails visibly instead of silently switching to binary floating point. Zero
  division and malformed expressions remain errors.
- The user's original request remains in the dialogue. The calculation record
  retains the expression, canonical result and precision/rounding metadata.

## Compatibility boundary

Introduce a separately versioned calculation result with a canonical decimal
string and a closed precision descriptor. Dispatch verification by the recorded
contract and version: legacy binary64 receipts must continue to be checked with
the existing binary64 evaluator, not reinterpreted as decimal values. Never
rewrite historical conversation or activity records during the transition.

Direct input, model-selected calls, custom-tool capability callbacks and
grounded calculation evidence currently share the calculator. Each boundary
must explicitly handle the new string representation and validate the expression
and result; numeric JSON coercion must not discard precision. Custom code cannot
gain new capabilities as a consequence of this change. Keep model instructions
and the tool's SKILL description aligned with the actual schema.

## Acceptance before switching defaults

Verify `0.1 + 0.2 = 0.3`, large integers beyond 2^53, signs and precedence,
scientific notation, exact and recurring division, ties and negative rounding,
zero division, malformed input, bounded nesting and resource limits. Verify
receipt tampering rejection and validation of existing binary64 receipts.
Exercise direct input, agent calls and custom tools, then use the actual app
offline to check display, history and saving. Report browser and physical-device
results separately. A decimal result must not be claimed as exact when it has
been rounded or its declared bounds were exceeded.
