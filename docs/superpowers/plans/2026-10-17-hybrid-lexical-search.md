# Hybrid lexical search

Actual Unit47 code query CEDAR-8642 returned3unrelated records because any character bigram match was accepted. Index ASCII words/underscore-hyphen compounds as complete lexical tokens while retaining non-ASCII character grams. Exact digit/compound tokens in queries are mandatory, preventing code partials and incidental overlaps. Ordinary non-identifier keywords retain OR ranking. Preserve NFKC normalization, aliases, current-source eligibility and exact original UTF-16 excerpt offsets; no canonical migration or model changes.

RED reproductions for fullwidth/case codes, prefix/suffix/no-match, code-plus-keyword; multilingual/late excerpt/aliases and existing corpus controls. Run baseline and prototype/build checks, then current native offline code and Japanese searches with exact build confirmation. This improves lexical precision, not semantic search correctness.
