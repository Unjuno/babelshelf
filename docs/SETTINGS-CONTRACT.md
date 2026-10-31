# Settings and Memory contract

## Source of truth

The product has two separate configuration layers:

- `design/prototype/src/app-settings.json` is the bundled factory baseline. Its app-owned schema, validators, storage limits and capability adapters define what the application can support. It is not the user's live preference store.
- User-adjustable values are versioned managed records in the local `mlb-memory-v1` IndexedDB `notes` store. The Settings screen and Memory view read and update the same records.

The user-facing Markdown paths are stable record identifiers and export/import representations. They are not files in the host operating system's filesystem. A direct edit, a Settings control, an approved chat proposal, backup and restore all operate on the same canonical record and its retained revisions.

The current preference records are:

| Memory path | User-adjustable values |
| --- | --- |
| `Settings/models.md` | Registered model choices, role selections, language choices, supported custom model declarations and named model sets |
| `Settings/appearance.md` | Theme, background, glass style, imported local fonts and validated named palettes |
| `Settings/connection.md` | Online/Offline asset access and sanitized local diagnostic logging |
| `Settings/harness.md` | Reply style, bounded user-defined system-prompt extension and named agent profiles |

Assistant instructions are included as a bounded system-message extension before the app-owned system protocol. This lets users set answer/workflow behavior while the later app rules retain priority for tool authority, source grounding, reviews, permissions and safety. The field is not an unrestricted replacement for the application prompt.

`Settings/README.md` explains these records. The bundled README is protected; the four managed records are user-owned and versioned. Settings and Memory controls cannot silently maintain separate effective values.

## Revision and recovery behavior

Each record has a stable ID and path, a current body, a version and retained earlier bodies. A validated save appends a revision. Undo appends the prior valid body as a new revision. Restoring defaults also appends a revision and preserves the existing history.

Preference documents carry `schemaVersion: 2`. Known version-0 and version-1 records are projected to the current shape in memory; merely reading one does not rewrite stored bytes. Only older schemas receive default-value migrations. Current-schema values remain explicit user settings, even when they equal a former factory default. The next explicit save writes the current format as a new revision. Unknown fields and malformed values are rejected. A future schema version is preserved and not overwritten; the app can fall back to the latest compatible revision or bundled defaults and offer targeted recovery.

Managed Settings edits use an exact record/path check and expected-revision comparison. Chat proposals show the target and complete Before/After values. Saving requires explicit approval. A stale, invalid or unsupported proposal changes nothing. Settings backup/restore retains the records and history and refuses conflicts instead of overwriting them silently.

## Extensibility

An existing setting can be edited within its validated schema. Supported definitions can also accept new entries: for example, named model sets, harness profiles and appearance palettes. The record schema and its app-owned consumer decide which additions are effective.

Adding a new kind of setting requires an app-owned schema, validation and migration, a consumer that applies it, and a suitable UI or constrained editor. A Markdown file alone cannot create a runtime feature. Runtime readiness comes from local verification of the selected implementation and assets; it is never inferred from a setting value.

User tools are paired Memory records under `Tools/user.<id>/SKILL.md` and `tool.js`. Creating or importing a validated pair stores both files and adds the new ID to the currently active harness profile in the same local save. Saving does not run the package; the local agent may call it in a later matching request. Editing either source later remains a reviewed, versioned Memory correction with compare-and-swap and Undo. Execution uses the bounded local QuickJS worker and only app-owned, explicitly declared local capabilities. This is constrained PWA extension support, not a general package manager, a hostile-code-proof sandbox or an MCP transport.

Adding a runtime capability, inference engine or model architecture still requires compatible application code and a verified adapter. User definitions cannot add arbitrary JavaScript permissions, network access, storage writes/deletes, credentials or executable UI. The chat protocol, evidence validation, tool adapters, hard resource limits, cancellation and approval boundaries remain app-owned.

## Agent-assisted changes

The normal chat path can propose supported preference changes. The app validates the structured proposal, target identity, allowed fields, revision and resulting record before offering Save. Profile proposals can select registered tools and lower app-owned budgets; they cannot raise limits or grant new capabilities. Settings proposals cannot toggle the network mode or start asset downloads.

For a user tool package, chat may propose changes to its code or usage file as a complete reviewed file. Package identity and declared capability grants remain fixed on that path. Source is not run during proposal or save; an already enabled package can run on a later matching request after the normal package, input and capability checks.

## Related contracts and verification

- [Memory-backed configuration and extensions](MEMORY-CONFIGURATION.md) defines settings precedence, schema requirements and supported setting kinds.
- [Current application architecture](ARCHITECTURE.md) describes the chat planner, profile use, tool execution and extension seam.
- [Tool packages](TOOL-PACKAGES.md) documents package intake, sandbox scope and limits.
- [Custom models](CUSTOM-MODELS-CONTRACT.md) defines model declarations, file inspection, preparation and supported runtime routes.
- [Backup contract](BACKUP-CONTRACT.md) defines retained revisions, conflict handling and restore.

Tests for preference parsing, legacy reads, direct Memory edits, Settings updates, chat proposals, approval, conflict refusal, Undo and backup/restore are part of the prototype and product acceptance suites. New setting kinds must add tests for first-run defaults, direct edit, Settings UI, agent proposal/approval, invalid/stale/future versions, migration, recovery, backup/restore, and effective-value resolution.
