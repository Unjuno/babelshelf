## Current canonical settings correction contract (Unit35)

Connection now exposes an Offline/Online application mode backed by the same historical downloads boolean. Read [CONNECTION-MODE.md](CONNECTION-MODE.md) for worker enforcement, restart/cancellation and scope. No additional preference field or model authority is introduced.

The current product persists managed preference records in canonical IndexedDB notes; historical session-only descriptions below describe early prototype stages. Settings controls and Memory read the same records and append revisions. The deployed app does not import arbitrary runtime code from a preference document.

Opened appearance/models settings support a finite `settings.patch` proposal through the same full Before/After, expected-record CAS, atomic note/receipt and append-only Undo as ordinary note correction. Canonical managed ID and exact path must match. Allowed appearance fields are theme/background/glass. Allowed model fields are registered text/decision/transcription/OCR selections and validated reading languages. Existing schema/catalog validation remains authoritative. Libraries, downloads/connection, readiness, runtime, URLs, credentials, paths, permission flags and Tools definitions are rejected. Use explicit existing Settings controls for registration/preparation/connection actions.

A proposal does not load a model or change a preference. Only explicit Save writes the reviewed validated body; settings screen values then derive from that revision. Backup validates operation fields/change hashes against retained before/after revisions. Unknown/tampered operations, stale notes and protected/forged targets refuse without overwriting. Broader typed Tools edits remain pending.

# Settings contract

The bundled prototype definition is design/prototype/src/app-settings.json. app-settings.ts validates and copies/freezes it before use. Current bundled schema version 7 rejects unknown/missing fields, unsupported models, invalid defaults, unsafe harness policy and oversized text budgets. Invalid bundled settings fail explicitly rather than silently choosing a model/provider. The old declarative media capability list was removed: it omitted PDF and OCR while duplicating execution state that the app never read. Only the text-input byte limit remains in `media`; `local-capabilities.ts` and its app-owned adapters determine executable capability and readiness.

## Current consumers

- Prototype model choices/defaults, appearance options/reset, and text-read budget.
- Memory path helpers: protected roots and maximum folder depth.
- Memory navigation: default Inbox capture destination.

The harness section specifies local-only processing, no implicit downloads or automatic overwrite/delete, clarification of ambiguous targets, original preservation and versioned sources. It cannot grant runtime permissions. Existing runtime guards remain independent. Never infer actual model availability from configuration; Media reading obtains the selected roles and verified asset status separately, and marks unsupported video-frame understanding explicitly.

## Boundaries

This JSON is bundled application configuration, not user Markdown content and not a script/plugin loading mechanism. Runtime modules, URLs and arbitrary tools cannot be added through it. Supported model IDs and storage invariants are checked in application code. Runtime/model asset revisions and hashes remain in dist/model-manifest.json; do not copy potentially stale asset pins into this file.

User choices such as selected model, downloads and theme persist as versioned local preference records. They do not mutate the bundled JSON or widen execution permissions. Existing notes/revisions are unaffected by changing bundled configuration.

A future schema version needs explicit migrations and evidence-based adapter readiness. Preparing an omni model must update runtime evidence only after assets, compatibility and capabilities are verified; it cannot set a JSON ready flag to bypass preparation.

## Transcription role

Schema 2 adds the independent transcription model catalog/default; version 1 is not a supported imported format. No user preference persistence existed to migrate. Tiny/base multilingual Whisper candidates are registry entries, not downloaded or installed assets. Settings > Speech to text > + / Add model registers/selects a catalog entry in session state; the selector can switch registered entries or Not configured. Adding never changes Text/Decision selections or grants readiness. Prepare stays disabled with Runtime not connected. The microphone surface shows the selected model/status and Open settings; it does not invoke browser SpeechRecognition or upload audio.

Model parameters/languages are checked against https://github.com/openai/whisper and https://huggingface.co/openai/whisper-tiny : tiny 39M, base 74M, both multilingual variants rather than .en. Parameter count is not download size, peak runtime memory, browser compatibility or Japanese accuracy evidence. No quality/performance guarantee is implied. Before downloads: pin exact model conversion/runtime revisions, asset names/byte sizes/SHA-256 and separate licenses, then verify local generation, cancellation and offline reload. The Bonsai manifest is unchanged.

Schema 3 adds the protected Tools root. The baseline persistent store is unchanged. Tool definition Markdown is not read by the settings loader and cannot override the bundled harness policy.

## Canonical preference records (prototype)

Settings is now a protected root. Its bundled README is read-only; models.md, appearance.md and connection.md are managed records with editable values and immutable IDs/paths. Each uses one fenced JSON block under a Markdown heading. Values are validated against the bundled catalogs and fixed per-document schemas. Unknown fields, invalid model/library references and unsupported appearance values fail before revision creation. The prior valid record remains active.

The Settings screen derives its values directly from these records. It has category entries Models, Appearance, Connection, Local files and Tools. A folder action opens Memory/Settings; each editable category has Open file. Control changes append revisions to the same record; direct file edits affect the controls. There are no parallel React states for model choices, library, downloads or appearance. Readiness and execution policy remain outside these documents. Local files actions are operations, not additional preference files.

Schema 4 adds Settings to bundled protected roots. No persistent baseline migration or disk files are claimed: these records live in the prototype's session state only. Source manifest pins and runtime guards remain unchanged. Production integration still needs durable transactions, conflict/version checking, backup/restore and preference schema migration. No credentials or executable code may be added to settings documents.

## Model library consistency
All three roles use Add model to register a bundled candidate and select it. Choice sheets contain only registered candidates plus Not configured and Add model. Models records now include textLibrary and decisionLibrary alongside transcriptionLibrary. The existing default Bonsai 4B is initially registered; no other text/decision candidate is implicitly registered. Registration is not download, installation or readiness. Legacy records lacking both new library fields are read by registering their current selections; the next explicit edit appends a revision preserving the legacy body bytes. No record/history is deleted. Unknown models, duplicate library entries and selecting an unregistered model are rejected.

## Tool documentation updates (Unit39)

Protected bundled Tools records describe connected reviewed schedule/settings operations as finite alternatives to ordinary-note rewrites. These descriptions do not register executable tools or permissions. Only exact known app-published historical bodies in increasing order may receive an appended documentation revision. Fresh previous defaults and the earlier original-to-current migration are recognized; modified, reversed, repeated, moved, imported, withdrawn or otherwise non-app records are skipped. Original revisions and unrelated metadata remain intact through the existing canonical initialization transaction. No arbitrary Tools editing/execution is enabled.

## Custom model declarations (Unit60)

Canonical models documents now accept customModels, at most64 strict declarations validated by dist/local-models.js. IDs and revisions derive from weightSHA256; role/engine/inspection fields have fixed schemas. No URLs, code, readiness, permissions or credentials. Duplicate identities fail. Text library/selection may reference a matching validated custom text declaration; other roles retain their pinned catalogs. This extends storage validation, not worker execution support.

Legacy bodies missing customModels project an empty array without changing stored bytes; the next explicit settings update appends a revision retaining the exact prior body. Backup/restoration carries declarations and retains model/runtime asset exclusions. Actual files must be independently verified by the engine before use. Model-proposed settings patches cannot edit customModels or libraries. Add-model file import, worker registration and product custom-model UI remain pending; manually declaring/selecting an unsupported model cannot make the current fixed worker execute it.

## Custom Add model UI (Unit62)

The earlier pending-worker/UI statement is superseded for structurally eligible Qwen3.5 GGUF custom text models: Choose local model > inspect > review > Add independently prepares local bytes and then appends the canonical registry/library/selection revision. Existing defaults are unchanged until explicit selection/Add. Persistent registry hydration and normal Send now use the real worker. Fixed-runtime requirement, unavailable architectures and generation quality remain explicit boundaries. No arbitrary engine installation, custom ONNX support, network permission or readiness enters via settings. See CUSTOM-MODELS-CONTRACT.md for cancellation, failed canonical writes and native acceptance scope.
