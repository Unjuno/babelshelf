# Structured text generation — Unit69

Observed failure: the actual SmolLM2 tokenizer preserves the full731-token planner prompt and latest request; ordinary unconstrained generation instead returned plain self-description. No template loss or context overflow was observed. Existing validation correctly refuses it. This evidence is not a universal diagnosis of small models.

Add optional, app-owned `dialogue-plan` / `dialogue-answer` output formats to TextEngine.generate. The ONNX adapter may constrain token probabilities to a compiled byte grammar. Other adapters retain ordinary generation with the same strict downstream validation; no constraint guarantee is inferred. Default generation and compaction remain unchanged.

The grammar permits model-selected action/query/valid target structures, exact historical selectors, reviewed capture bodies, or a dialogue answer string. It does not invent missing values, repair returned JSON, grant authority, save, execute or retry. String tokens preserve valid UTF-8 across token boundaries. EOS is allowed only for complete output. Token-budget exhaustion before completion must fail, not close JSON synthetically. Existing output parsing, target binding, original/version checks, approval and CAS remain authoritative.

Validate grammar boundaries and cancellation controls, then actual PC normal Send after offline process restart. Retain failed original turns and distinguish syntax, semantic/action accuracy and phone acceptance. No model default change, implicit downloads or cloud inference.

## Current evidence and limits

The first native trial failed before producing any constrained token. The installed ByteLevel decoder's reverseDictionary stores byte values as decimal strings, while the initial adapter accepted only number values. This excluded every token. The initial numeric-only control fixture missed the integration defect. Normalization now handles strict decimal strings; the regression fixture uses that real representation. An independent actual AutoTokenizer check leaves two valid initial tokens and accepts Japanese/emoji JSON tokens, while preserving all731 planner-prompt tokens. Empty diagnostic prefixes also no longer call decode([]).

After the fix, actual PC offline normal Send completed the planner and dialogue-answer grammar. The model chose chat and returned answer `...`; this establishes structured transport, not a useful greeting or semantic quality. No answer was substituted or synthesized by the harness. The normal reply quality and a useful alternative initial model remain open; model defaults stay unchanged.

Structured failures are propagated as bounded PlannerOutputError diagnostics (raw prefix8192characters, reason, truncation flag) for existing on-demand failed planner activity. They are never answers, retry input, history instructions or execution authority. Stop overrides late diagnostics. No synthetic closing delimiter is added at the output limit.

Unit72 makes the planner format request-specific using a harness-owned scope object. The advertised catalog and optional token grammar omit unavailable input/file/current scopes; historical user indices are bounded and assistant indices must identify actual retained answers, including archived originals. See PLANNER-SCOPE.md for actual failures and final PC regression. This removes structural choices without choosing the user's intent, repairing a result or granting execution authority. Existing model-independent validation remains mandatory, and adapters that do not constrain generation retain that boundary.
