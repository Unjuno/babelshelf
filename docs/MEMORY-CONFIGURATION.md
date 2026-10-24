# Memory-backed configuration and extensions

## Product rule

User-adjustable behavior is stored as versioned records in the local Memory store. Settings controls read and write those same records; a setting must not have one value in the Settings screen and a separate hidden value in application state. Memory remains an IndexedDB-backed document model, not a host filesystem. Markdown paths are stable user-facing identifiers and export/import representations.

The bundled application configuration is the factory baseline and schema registry. It supplies defaults, supported choices, storage invariants, validation rules and the list of executable capabilities. It is not the user's live preference store. First-run initialization copies the defaults into canonical local Settings records. Restore defaults appends a new revision with baseline values; it never deletes the existing record or its history.

## Layering and extension

Configuration resolves in three layers:

1. **Application contract** — bundled schemas, hard limits, data-integrity rules and app-owned capability adapters. These remain authoritative.
2. **Bundled defaults** — named starter profiles, themes, model catalog entries and tool packages. They can be restored.
3. **User Memory** — edits to a known definition and additive user definitions with new, namespaced IDs.

For an existing ID, the validated user revision is effective. A new ID adds a choice when its schema and consumer explicitly support that kind of definition. Unknown fields are rejected rather than silently interpreted. Invalid records remain available for repair but do not replace the last valid effective value. No user record can raise application hard limits or grant a capability.

If the current settings body is invalid, readers scan its retained revisions newest-first and use the latest valid body. When historical path metadata exists, only entries for that setting's canonical path qualify. If none is valid, the bundled default is used. The invalid current body stays intact until an explicit settings change or default restore appends a new validated revision; the invalid bytes are retained in history.

Each canonical Settings file carries an integer `schemaVersion`. Current files use version `1`; older files with no version are treated as version `0` and migrated in memory using only known, deterministic migrations. Reading a legacy file does not rewrite it. Its next explicit, validated save writes the current schema version as a new revision. A file with a schema version newer than the application supports is not parsed as current settings and is never silently replaced by defaults. The app can continue using the latest compatible historical revision (or bundled defaults) while presenting a per-file recovery action. Recovery preserves the unsupported body in history and appends a compatible revision; it does not touch other Settings files.

This makes configuration Pi-like in the useful sense: people can shape behavior with local definitions and add extensions without rebuilding the product. It does not mean arbitrary Markdown is executable. A newly added definition only has an effect through a registered application consumer or an explicitly imported extension runtime.

## Agent edits

Chat may propose a change to a supported user-owned definition. The app shows the exact target, before/after values, validation result and affected behavior. Saving requires explicit user approval, an expected revision check and an append-only history entry. Undo appends the previous valid content as a new revision. A failed, stale or invalid proposal changes nothing. Connection proposals can toggle sanitized local diagnostic logging; they cannot change Online/Offline, asset downloads or start network work.

An agent cannot silently edit factory code, tool permissions, network policy, model/runtime bytes, credentials, storage invariants or arbitrary executable UI. Settings changes such as appearance, reply style, supported model selection, user model sets and harness-profile values use typed schemas. Model-set proposals can name combinations of already registered roles; the app validates the full definition, then requires review, revision check and explicit approval. Adding a tool package is a distinct import/create, inspect, test and opt-in flow; saving a skill does not itself enable it.

## What can be extended today

- `Settings/harness.md`: reply style, user guidance and bounded profiles selecting registered tools.
- `Settings/connection.md`: asset download policy and diagnostic logging. Chat may propose `diagnosticLogs` changes because they retain only sanitized local failure metadata; Online/Offline and asset-download policy remain direct user controls.
- `Settings/appearance.md`: theme choices, local font registry and up to 12 named high-contrast palettes. A palette can be added or edited in this Memory record and selected from Settings; older single-palette settings are read without changing their stored revision.
- `Settings/models.md`: validated model declarations, role selections and up to 32 named user model sets. Sets can be added by saving current role choices, editing the `customSets` array, or asking chat for a reviewed proposal. They can reference only models already registered for their role and do not prepare/download files or claim device compatibility.
- `Tools/user.<id>/SKILL.md` with `tool.js`: an explicit custom-tool package, executed by the bounded local QuickJS host with only its declared app-owned capabilities. Its closed input schema (1–8 bounded scalar fields) is editable in the creation form or Memory source. When either source file is open, chat can propose a full-file revision through Before/After review, exact paired-source CAS, version history and Undo. `SKILL.md` identity and capabilities are immutable; schema edits never silently rewrite companion code. A `tool.js` proposal is validated with its paired `SKILL.md`, remains inert while drafting/reviewing/saving, and does not gain capabilities. If already selected in a profile, the newly reviewed revision can be used on a later matching request; Test remains an explicit separate action.
- User knowledge and scheduled prompts: ordinary versioned Memory records interpreted by their registered domain consumers.

Adding a new **kind** of configuration is not file-only today. It requires an application-owned schema, validation/migration, runtime consumer and UI or a reviewed generic editor that is intentionally constrained. The setting can then be stored, inspected, backed up and restored through Memory. This limit is deliberate: arbitrary keys must not become hidden code paths or permission grants.

Built-in tool packages follow the same boundary from input through output: the package registry returns `unknown`, then an app-owned typed adapter validates the exact result shape and limits before a caller can consume it as `memory.search`, `memory.read`, or `math.calculate`. User-defined package results also remain `unknown` and transient inside the bounded agent call; they do not become canonical Memory records or citations by themselves. Extensibility therefore comes from adding definitions and explicitly opting in to registered capabilities, while the application retains authority over executable operations and trusted evidence.

## Required contract for future settings

Every new setting type must define its stable Memory path and ID, current schema version, defaults, allowed additions/overrides, validation and migration behavior, forward-version behavior, runtime consumer, approval boundary, history/Undo behavior, backup behavior and offline behavior. The Settings UI must link to the same record shown in Memory. Tests must cover first-run creation, direct edit, UI edit, agent proposal/approval, invalid/stale input, legacy migration without read-time writes, unsupported future versions, targeted recovery, restore, backup/restore and effective-value resolution.

When a setting affects execution, the record is configuration only. Readiness must come from a successful local preparation/verification path, and permission must come from an app-owned capability grant. Neither may be inferred from a model declaration or a Markdown field.
