# Accepted product and UI specification

Updated 2026-10-17 JST. This is the current design baseline, replacing historical bottom-toggle, fixed rail and tap-to-open iterations. It specifies intended behavior; implementation status is listed separately.

Current implementation: canonical storage, native PWA shell and actual PC Bonsai4B are connected. Continuous dialogue/compaction and canonical foreground task records are described in [CONVERSATION-CONTRACT.md](CONVERSATION-CONTRACT.md) and [SCHEDULE-CONTRACT.md](SCHEDULE-CONTRACT.md). Historical implementation-status paragraphs below are superseded by these contracts and MODEL-RUNTIME-VERIFICATION; full/device MVP acceptance is still incomplete.

## Purpose and operating constraints

A PWA usable on Android/iPhone without app-store distribution. After explicit preparation of verified app/runtime/model assets, normal knowledge operations must work without reconnecting. Knowledge belongs in local stored records and their original sources, not in a model or chat session.

No required account, external API, cloud sync or resident server agent. Downloads/updates default OFF. Enabling downloads does not authorize remote inference or personal-data processing. Missing normal-use assets must produce a useful local error, not an implicit fetch.

The user may later choose external tools/MCP/frontier models as an optional separate integration. No upload or external connection is enabled by default; a connector cannot read an offline browser database by assumption. Scope and consent remain future work.

## Accepted surface

- Main input/results surface supports natural-language record/search/read/summarize/answer/save. No sessions or New chat; no branding heading, Chat/Notes tab split, sidebar, hamburger, bottom navigation, explanatory paragraphs or marketing copy.
- UI labels are English; stored content, inputs and generation are multilingual.
- Glass control material inspired by iOS 26, upright recognizable icons, readable opaque text and short status/error labels. This is a web interpretation, not native Apple Liquid Glass.
- Input button upper-left. Pointer tap returns to input; 50ms hold displays a curved four-item menu. Sliding to an item and releasing switches destination. Returning to center/outside cancels after movement. Stationary release closes and returns to Input. No decorative line in the button.
- Menu: Memory, Schedule, Notifications, Settings. Keyboard activation/arrows/Escape and assistive access must remain. Actual 50ms touch discrimination still needs device testing.
- Photo, voice and Send are compact. Current attachments/audio are previews only.
- Answers show a small source mark near the relevant text; source details and the exact original remain available on demand. No automatic filename clutter in ordinary answers.

## Memory and paths

Memory opens at Home, analogous to a user's own area rather than a system root. Home has Inbox, Notes and Files. Breadcrumbs navigate each ancestor; folder rows enter their immediate contents. Upper-level Memory navigation explicitly reveals internal locations.

Canonical roots: Inbox, Notes, Schedule, Notifications, Attachments, Tools, Settings. They cannot be renamed, moved or deleted by the UI, models or tools. User files/subfolders are writable below them. Maximum stored folder depth is five, including the system root. IDs, links, references and previous versions survive path edits.

Home is a display grouping, not another stored folder or account. Home / Files maps to Attachments; Home / Notes maps to Notes; Home / Inbox maps to Inbox. The prototype never creates OS Markdown files. Baseline persistence is IndexedDB with an inspectable projection/export, documented in STORAGE-CONTRACT.md.

Default capture goes to Inbox. Creation in an open directory uses that directory. Home file creation defaults to Inbox; Home child-folder creation defaults to Notes, with the destination shown before Save. The root is not a normal create destination. Do not delete old paths/data to make this arrangement fit.

## Editing, tools and authorization

Ordinary use is natural language. Direct editing remains available as a reliable correction path; typed fields may edit schedules without exposing internal IDs. Tools and all views operate on the same canonical record, never parallel copies.

A clear user instruction for a specific target/change can authorize that exact tool patch. Show an auditable receipt afterwards, e.g. Updated, changed time, Open and Undo. Do not require a large modal for every already-authorized correction. Ambiguous scope or inferred material changes need a review before execution.

A patch must identify record ID, expected revision and intended changes. Validate schema, target, authorization, root/path restrictions and expected version before committing. Model text, document instructions, scheduled prompts and tool results cannot grant blanket authorization. No model-originated unapproved overwrite/delete.

Retain previous bytes/paths, change identity/time and provenance. Undo adds a new revision and checks the current version; it does not erase history. Saving a generated answer uses its existing bytes, an explicit user action/content review and a new ID; never regenerate while saving.

The direct editor/history exist in the prototype; actual tool-patch receipts/undo and their persistence integration are pending.

## Schedule and notifications

Schedule is a view over scheduled-task records in protected storage. Editing the same record through Memory must update Schedule. Each task has a stable ID, structured date/time/timezone or recurrence, prompt, enabled state and version.

A filename such as 2026-10-20_0900.md helps people find a task. Structured metadata is the execution authority: renaming a file alone must not reschedule or execute it. Do not execute arbitrary file text just because it was dropped in a directory; registration/enabling and permission scope are explicit.

Record due occurrence, task ID/revision, attempt, status and result. Avoid duplicate occurrence execution. Handle overdue work explicitly on resume; do not silently replay stale destructive/external side effects.

Notification rules define triggers (task finished, local deadline elapsed, local event) and permitted actions. Notification events are the resulting records, linked to source/task and rule versions. Read/unread state is distinct from an execution rule.

No guarantee is made that a closed, fully offline PWA can wake at a scheduled time. Background execution/notifications and platform limits must be verified before promising delivery. No server/push-service dependency is introduced as a workaround.

The prototype currently holds separate schedule preview state, not Markdown-backed executable tasks. Notification view is an empty inbox. Both require canonical integration.

## Models and extensibility

Text candidate: PrismML Ternary Bonsai 2 4B first, 2B fallback after validation. Decision candidates: Liquid AI Open d1-omni-600M and d1-3B. Model roles are independent and replaceable; one future model may fill multiple roles only if capabilities are verified.

Open d1 produces typed decisions/probabilities; it does not replace text generation. Omni is not a promise of arbitrary transcription, OCR, video analysis or simultaneous image/audio support. See MODEL-CANDIDATES.md for sources and limitations.

Selection, preparation, installed assets and runtime readiness are different states. The prototype model pickers are glass choice sheets; selection never claims a download or working inference. No cloud inference fallback.

Before enabling a runtime/model: pin revision, asset size/hash and license; inspect architecture, quantization transforms, tokenizer/template, decision heads and preprocessing. Bonsai PTQ1_0/PQ2_0/Q2_0/Hadamard handling is not established by passing a GGUF to WebLLM. Model Apache-2.0 licensing does not license the upstream runtime.

## Persistence and acceptance

Preserve original content, IDs, append-only revisions, withdrawal state, explicit links, exact source revision/ranges and multilingual search. Local file backup/restore must reject or surface conflicts without silent replacement.

Required offline acceptance after app shutdown/restart: new notes, TXT/MD import, index rebuilding, search, fresh generation and summary, confirmed generated-result save, backup and restore. Test real model load/stop/offline reload separately from Node helpers and desktop phone simulations.

## Status

Accepted interactive UI: design/prototype/. Baseline core/PWA: dist/. No integration between them is claimed. Persistent tool correction, canonical scheduled tasks, actual notifications, working local d1, real Bonsai generation, full offline cold restart and physical iPhone/Android acceptance remain pending.

Favicon: a completely blank white paper/square with no visible mark or text. This applies to browser tab favicons; existing installed-PWA home-screen icons have not been redesigned.

## File operations and recovery

Fixed canonical directories and Home are protected. A 450ms item hold opens the same glass action sheet as the accessible Actions button; ordinary tap opens the item. Files offer Edit / Delete, user folders Rename / Delete. Input navigation retains its separate 50ms hold. The compact arc uses 75px radius and a 110-degree sweep while preserving 44px secondary targets.

Delete requires target confirmation; folders show descendant file/folder counts. Retain exact records/revisions in recovery batches. Immediate Undo and Settings > Local files > Trash > Restore provide recovery. Restore refuses conflicting IDs/paths rather than overwriting. Memory's header has only creation +; do not put an ambiguous Trash icon beside it.

Prototype Trash is transient React state, not durable recovery or space reclamation. Permanent deletion/retention/storage controls remain pending. Deleting a notification only removes that event, never its source schedule or execution history.

## Attachments, capabilities, appearance and notification details

See MEDIA-HARNESS.md for the accepted processing/provenance and decision boundaries. Prototype supports multi-attachment originals and bounded TXT/MD reading, sent-input grouping, original inspection, Media readiness statuses, Theme/Background/Glass/reset controls, and read/detail/delete notification receipts linked to schedules. Settings and records are transient; processing models, canonical notification storage and media-aware citations are not integrated.

- Scheduled work is a prompt: New/Edit schedule uses a multiline Prompt with exact body preservation, not a title-only task. List heading derives from the first line; notification receipts retain the prompt. Repeat uses the same app-owned glass choice sheet (Every day/Every week) with draft-preserving return/Cancel; no native select menu. Execution and canonical persistence remain unconnected.

## Tools directory

Tools is a protected canonical root reached through the Memory ancestor, outside Home. Bundled README, memory.search/read/capture/patch and disabled mcp.example definitions are readable but protected from edit/delete. User definitions can be created below Tools and edited/deleted normally. Files are Markdown records in the prototype projection, not OS-installed tools or executable plugins.

A definition is data, never execution permission. New/custom/MCP definitions remain inactive until an adapter validates schema, operation scope, endpoint, exposed tool changes, data disclosure and explicit user enablement. Do not put credentials in Markdown, exported records or model context. No arbitrary JS, shell, stdio process or module URL may be launched from these files. Built-in adapters stay bundled and independently enforce permissions. Do not connect on boot or merely because a file is present. All ordinary local functions must remain usable without an external MCP service.

Current implementation: inspectable session-only definitions and protected operations; not an MCP client, registry loader or execution adapter. Schema 3 adds Tools without migrating/deleting baseline records. Typed schemas, validation/import, consent and transport implementations are next work.

## Unified Settings records

Settings belongs at the Memory root and cannot be deleted or renamed. Standard models.md/appearance.md/connection.md files have fixed IDs/paths, editable validated JSON values and retained revisions. README is read-only. The dedicated Settings screen edits the same records, with short category entries and links to Memory; it does not maintain duplicate preference state. Invalid edits leave the current valid setting intact. Runtime readiness, permissions and secrets never come from these user-editable files. Prototype records remain session-only.

## UI review corrections and file previews

Input/results shows only a compact inline source marker beside the answer. Tapping it opens source details with filename, exact revision/location and original text or media preview; source cards are not permanently displayed below answers. The reusable attachment renderer supports original image/video thumbnails and audio Listen affordances. The bundled exchange is a static prototype fixture with no visible Example label; its source remains pinned to original v1, independent of later edits. Sent attachments use the same preview renderer but are labeled Attachment plus actual processing status; they are not presented as generated-answer citations. No model has analyzed them.

Editor Save/Cancel are fixed above the keyboard; scheduled prompt fields scroll independently from the footer. Send and source controls have 44px boxes. Managed setting files show Fixed path rather than the same read-only lock used for bundled definitions; managed files remain directly editable. Folder protection remains enforced without implying all contents are read-only.

The navigation retains the approved 50ms hold with a short Hold/Menu hint; no real-touch usability pass is claimed. Unread notifications appear as a badge on the collapsed input/menu button and a dot on the notification destination. Model preparation actions are uniformly disabled until a runtime is connected; dark-mode readiness labels use opaque readable foregrounds.

Weekly schedules have explicit weekday. Time basis is the device timezone at save, with local next-occurrence preview; this is not a promise of closed-PWA wakeup. The preview helper advances local wall-clock dates (including platform DST normalization). Arbitrary timezone selection/conversion, DST ambiguity policy and production execution remain unimplemented. Changing device zone is not a validated scheduling workflow.

Settings panels use a single Back/title/settings-file toolbar, consistent card spacing and choice sizes, and the same light/dark states. Appearance presents Theme, Background and Glass in separate cards matching model-role cards. Local files omits the file shortcut because it has no corresponding preferences record.

## Schedule conditions and model registration
All model roles share Add model -> registered choices, backed by the models preference record. Adding selects a catalog entry without downloading assets or asserting readiness.
Schedule editing supports Once (local date/time), Every day, Every week (one or more weekdays), Every month (day 1–31), and Custom (1–365 days/weeks anchored to a local start date). New schedules default to Once. Past one-off times, invalid dates, empty weekdays and invalid intervals are rejected. Monthly dates absent from a month are skipped, as stated in the UI. Custom intervals use calendar dates rather than elapsed 24-hour multiples. Time zone is the device zone captured at save; arbitrary-zone evaluation and DST ambiguity controls remain pending.
Prompt bytes survive repeat-sheet transitions, save and re-edit. Conditions live in the session schedule record rather than filenames. These records are not yet canonical Memory files, persistent schedules, execution logs, or OS delivery evidence; the runtime/Memory integration remains pending.
