# Settings contract

The bundled prototype definition is design/prototype/src/app-settings.json. app-settings.ts validates and copies/freezes it before use. Schema version 3 rejects unknown/missing fields, unsupported models, invalid defaults, unsafe harness policy and oversized text budgets. Invalid bundled settings fail explicitly rather than silently choosing a model/provider.

## Current consumers

- Prototype model choices/defaults, appearance options/reset, media labels and text-read budget.
- Memory path helpers: protected roots and maximum folder depth.
- Memory navigation: default Inbox capture destination.

The harness section specifies local-only processing, no implicit downloads or automatic overwrite/delete, clarification of ambiguous targets, original preservation and versioned sources. It is a declarative contract for the future execution adapter, NOT a running planner or permission system. Existing baseline runtime guards remain independent and unchanged. Never infer actual model availability from configuration. The Media UI currently passes no runtime readiness evidence, so all candidate processing capabilities remain Not prepared.

## Boundaries

This JSON is bundled application configuration, not user Markdown content and not a script/plugin loading mechanism. Runtime modules, URLs and arbitrary tools cannot be added through it. Supported model IDs and storage invariants are checked in application code. Runtime/model asset revisions and hashes remain in dist/model-manifest.json; do not copy potentially stale asset pins into this file.

User choices such as selected model, downloads and theme are currently session-only UI overrides. They do not mutate the bundled JSON. Persistent local preference records, validation/migration and a user-facing import/export format remain integration work. User preferences must never widen execution permissions. Existing notes/revisions are unaffected by changing UI defaults.

A future schema version needs explicit migrations and evidence-based adapter readiness. Preparing an omni model must update runtime evidence only after assets, compatibility and capabilities are verified; it cannot set a JSON ready flag to bypass preparation.

## Transcription role

Schema 2 adds the independent transcription model catalog/default; version 1 is not a supported imported format. No user preference persistence existed to migrate. Tiny/base multilingual Whisper candidates are registry entries, not downloaded or installed assets. Settings > Speech to text > + / Add model registers/selects a catalog entry in session state; the selector can switch registered entries or Not configured. Adding never changes Text/Decision selections or grants readiness. Prepare stays disabled with Runtime not connected. The microphone surface shows the selected model/status and Open settings; it does not invoke browser SpeechRecognition or upload audio.

Model parameters/languages are checked against https://github.com/openai/whisper and https://huggingface.co/openai/whisper-tiny : tiny 39M, base 74M, both multilingual variants rather than .en. Parameter count is not download size, peak runtime memory, browser compatibility or Japanese accuracy evidence. No quality/performance guarantee is implied. Before downloads: pin exact model conversion/runtime revisions, asset names/byte sizes/SHA-256 and separate licenses, then verify local generation, cancellation and offline reload. The Bonsai manifest is unchanged.

Schema 3 adds the protected Tools root. The baseline persistent store is unchanged. Tool definition Markdown is not read by the settings loader and cannot override the bundled harness policy.
