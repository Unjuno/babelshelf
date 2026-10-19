# Accepted product and UI specification

Updated 2026-10-18 JST. This is the current design baseline, replacing historical bottom-toggle, fixed rail and tap-to-open iterations. It specifies intended behavior; implementation status is listed separately.

This file defines accepted behavior. Current implementation evidence belongs in [MVP-ACCEPTANCE.md](MVP-ACCEPTANCE.md), remaining gates in [REMAINING-GATES.md](REMAINING-GATES.md), and historical observations in [TEST-RESULTS.txt](TEST-RESULTS.txt). A requirement here is not evidence that it passed on a device.

## Purpose and operating constraints

A PWA usable on Android/iPhone without app-store distribution. After explicit preparation of verified app/runtime/model assets, normal knowledge operations must work without reconnecting. Knowledge belongs in local stored records and their original sources, not in a model or chat session.

No required account, external API, cloud sync or resident server agent. Downloads/updates default OFF. Enabling downloads does not authorize remote inference or personal-data processing. Missing normal-use assets must produce a useful local error, not an implicit fetch.

The user may later choose external tools/MCP/frontier models as an optional separate integration. No upload or external connection is enabled by default; a connector cannot read an offline browser database by assumption. Scope and consent remain future work.

## Accepted surface

- Main input/results surface supports natural-language record/search/read/summarize/answer/save. No sessions or New chat; no branding heading, Chat/Notes tab split, sidebar, hamburger, bottom navigation, explanatory paragraphs or marketing copy.
- UI labels are English; stored content, inputs and generation are multilingual.
- Glass control material inspired by iOS 26, upright recognizable icons, readable opaque text and short status/error labels. This is a web interpretation, not native Apple Liquid Glass.
- Input button upper-left. Touch/pen tap returns to input; 50ms hold displays a curved four-item menu. Mouse/trackpad click opens a persistent menu; click a destination to navigate, or click Input again to return to input. Sliding to an item and releasing switches destination. Returning to center/outside cancels after movement. Stationary release closes and returns to Input. No decorative line in the button.
- Menu: Memory, Schedule, Notifications, Settings. Keyboard activation/arrows/Escape and assistive access must remain. Actual 50ms touch discrimination still needs device testing.
- Attachment, voice and Send controls are compact, with at least 44px targets. Display each original and its actual extraction state; preview/playback alone never implies model understanding.
- Answers show a small source mark near the relevant text; source details and the exact original remain available on demand. No automatic filename clutter in ordinary answers.

## Memory and paths

Memory opens at Home, analogous to a user's own area rather than a system root. Home has Inbox, Notes and Files. Breadcrumbs navigate each ancestor; folder rows enter their immediate contents. Upper-level Memory navigation explicitly reveals internal locations.

Canonical roots: Inbox, Notes, Schedule, Notifications, Attachments, Tools, Settings. They cannot be renamed, moved or deleted by the UI, models or tools. User files/subfolders are writable below them. Maximum stored folder depth is five, including the system root. IDs, links, references and previous versions survive path edits.

Home is a display grouping, not another stored folder or account. Home / Files maps to Attachments; Home / Notes maps to Notes; Home / Inbox maps to Inbox. The Memory tree projects canonical IndexedDB records; it is not an OS directory. Explicit Markdown exports and full-state backups are separate local files, documented in STORAGE-CONTRACT.md.

Default capture goes to Inbox. Creation in an open directory uses that directory. Home file creation defaults to Inbox; Home child-folder creation defaults to Notes, with the destination shown before Save. The root is not a normal create destination. Do not delete old paths/data to make this arrangement fit.

## Editing, tools and authorization

Ordinary use is natural language. Direct editing remains available as a reliable correction path; typed fields may edit schedules without exposing internal IDs. Tools and all views operate on the same canonical record, never parallel copies.

A model correction identifies the target and presents Before/After for explicit approval before saving. The approval applies only to that proposal and expected record revision; ambiguous targets require clarification. Afterwards retain an auditable receipt and revision-based Undo. Direct edits and explicit delete/restore controls have their own bounded user actions; document text and model output cannot approve them.

A patch must identify record ID, expected revision and intended changes. Validate schema, target, authorization, root/path restrictions and expected version before committing. Model text, document instructions, scheduled prompts and tool results cannot grant blanket authorization. No model-originated unapproved overwrite/delete.

Retain previous bytes/paths, change identity/time and provenance. Undo adds a new revision and checks the current version; it does not erase history. Saving a generated answer uses its existing bytes, an explicit user action/content review and a new ID; never regenerate while saving.

Ordinary-note, finite schedule and finite settings proposals use their respective validators. Generic body rewriting must not bypass protected/system-record rules. Operation details and implementation limits are in CORRECTION-CONTRACT.md and SETTINGS-CONTRACT.md.

## Schedule and notifications

Schedule is a view over scheduled-task records in protected storage. Editing the same record through Memory must update Schedule. Each task has a stable ID, structured date/time/timezone or recurrence, prompt, enabled state and version.

A filename such as 2026-10-20_0900.md helps people find a task. Structured metadata is the execution authority: renaming a file alone must not reschedule or execute it. Do not execute arbitrary file text just because it was dropped in a directory; registration/enabling and permission scope are explicit.

Record due occurrence, task ID/revision, attempt, status and result. Avoid duplicate occurrence execution. Handle overdue work explicitly on resume; do not silently replay stale destructive/external side effects.

Notification rules define triggers (task finished, local deadline elapsed, local event) and permitted actions. Notification events are the resulting records, linked to source/task and rule versions. Read/unread state is distinct from an execution rule.

No guarantee is made that a closed, fully offline PWA can wake at a scheduled time. Background execution/notifications and platform limits must be verified before promising delivery. No server/push-service dependency is introduced as a workaround.

Scheduled tasks, execution records and notification events use the same canonical notes shown by Memory. New tasks are paused; restored tasks require review. Their occurrence/lease/retry/result-pin rules are defined in SCHEDULE-CONTRACT.md. The current inbox is in-app; closed-PWA/OS delivery remains outside the promise.

## Models and extensibility

Text candidate: PrismML Ternary Bonsai 2 4B first, 2B fallback after validation; 9B is an optional larger text candidate with device execution still unverified. Decision candidates: Liquid AI Open d1-omni-600M and d1-3B. Model roles are independent and replaceable; one future model may fill multiple roles only if capabilities are verified.

Open d1 produces typed decisions/probabilities; it does not replace text generation. Omni is not a promise of arbitrary transcription, OCR, video analysis or simultaneous image/audio support. See MODEL-CANDIDATES.md for sources and limitations.

Selection, preparation, installed assets and runtime readiness are different states. All model-role pickers use Add model -> registered choices -> explicit preparation/verification. Glass choice sheets replace native option popups; selection never claims a download or working inference. Latest user direction permits additional compatible local models without replacing existing defaults silently. No cloud inference fallback.

Before enabling a runtime/model: pin revision, asset size/hash and license; inspect architecture, quantization transforms, tokenizer/template, decision heads and preprocessing. Bonsai PTQ1_0/PQ2_0/Q2_0/Hadamard handling is not established by passing a GGUF to WebLLM. Model Apache-2.0 licensing does not license the upstream runtime.

## Persistence and acceptance

Preserve original content, IDs, append-only revisions, withdrawal state, explicit links, exact source revision/ranges and multilingual search. Local file backup/restore must reject or surface conflicts without silent replacement.

Required offline acceptance after app shutdown/restart: new notes, TXT/MD import, index rebuilding, search, fresh generation and summary, confirmed generated-result save, backup and restore. Test real model load/stop/offline reload separately from Node helpers and desktop phone simulations.

## Status

The accepted UI and canonical adapter live in design/prototype/src. Its separate product entry supplies native browser controls and the built PWA. dist/ retains the shared baseline core/worker and its independent shell. Connected features and exact measured builds are listed in MVP-ACCEPTANCE.md; none of these locations alone establishes full offline or physical-device acceptance.

Favicon and install icons are completely blank white squares, with no glyph, text, folded corner or branding. Keep required manifest sizes and install metadata.

## File operations and recovery

Fixed canonical directories and Home are protected. A 450ms item hold opens the same glass action sheet as the accessible Actions button; ordinary tap opens the item. Files offer Edit / Delete, user folders Rename / Delete. Input navigation retains its separate 50ms hold. The compact arc uses 75px radius and a 110-degree sweep while preserving 44px secondary targets.

Delete requires target confirmation; folders show descendant file/folder counts. Retain exact records/revisions in recovery batches. Immediate Undo and Settings > Local files > Trash > Restore provide recovery. Restore refuses conflicting IDs/paths rather than overwriting. Memory's header has only creation +; do not put an ambiguous Trash icon beside it.

Trash and folder metadata persist with canonical note lifecycle changes. Withdrawals/restorations append revisions and preserve original bytes. Trash is recovery, not permanent purge or storage reclamation. Arbitrary storage-pressure resilience remains a separate gate. Deleting a notification only removes that event, never its source schedule or execution history.

## Attachments, capabilities, appearance and notification details

See MEDIA-HARNESS.md for the accepted processing/provenance and decision boundaries. Keep multi-attachment input, individual removal/inspection, sent-input grouping, truthful capability/readiness status, Theme/Background/Glass/reset and source-linked notification details. Raw originals and derived extractions are separate durable records after Send or reviewed Save. Unsent drafts are not durable. Model/runtime assets and operating-system permissions remain separate from canonical knowledge/preferences.

- Scheduled work is a prompt: New/Edit schedule uses a multiline Prompt with exact body preservation, not a title-only task. List heading derives from the first line; notification receipts retain the prompt. Repeat uses the same app-owned glass choice sheet with the conditions listed below and draft-preserving return/Cancel; no native select menu. Foreground execution uses the canonical task, not a second UI copy.

## Tools directory

Tools is a protected canonical root reached through the Memory ancestor, outside Home. Bundled README, memory.search/read/capture/patch and disabled mcp.example definitions are readable but protected from edit/delete. User definitions can be created below Tools and edited/deleted normally. Bundled tool packages contain code and SKILL.md, with protected inspectable Memory projections. A projected file is not an OS-installed tool or executable plugin.

A definition is data, never execution permission. New/custom/MCP definitions remain inactive until an adapter validates schema, operation scope, endpoint, exposed tool changes, data disclosure and explicit user enablement. Do not put credentials in Markdown, exported records or model context. No arbitrary JS, shell, stdio process or module URL may be launched from these files. Built-in adapters stay bundled and independently enforce permissions. Do not connect on boot or merely because a file is present. All ordinary local functions must remain usable without an external MCP service.

Only trusted bundled adapters execute. Their exact tool/code/skill identity is audited. Custom definitions and the MCP template remain inactive data; external MCP execution is not connected. See TOOL-PACKAGES.md and HARNESS-ACTIVITY.md. Preserve all existing records when extending the registry.

## Unified Settings records

Settings belongs at the Memory root and cannot be deleted or renamed. Standard models.md/appearance.md/connection.md files have fixed IDs/paths, editable validated JSON values and retained revisions. README is read-only. The dedicated Settings screen edits the same records, with short category entries and links to Memory; it does not maintain duplicate preference state. Invalid edits leave the current valid setting intact. Runtime readiness, permissions and secrets never come from these user-editable files. Settings values persist as append-only canonical records; actual runtime readiness is checked independently.

## UI review corrections and file previews

Input/results shows only a compact inline source marker beside the answer. Tapping it opens source details with filename, exact revision/location and original text or media preview; source cards are not permanently displayed below answers. The reusable attachment renderer supports original image/video thumbnails and audio Listen affordances. Do not seed a fixture conversation or label simulated output as inference. Historical citations open their exact retained original revision even after later edits. Sent attachments use the same preview renderer but are labeled Attachment plus actual processing status; they are not presented as generated-answer citations. Only a verified completed extraction may supply evidence; a filename, descriptor or thumbnail is not decoded content.

Editor Save/Cancel are fixed above the keyboard; scheduled prompt fields scroll independently from the footer. Send and source controls have 44px boxes. Managed setting files show Fixed path rather than the same read-only lock used for bundled definitions; managed files remain directly editable. Folder protection remains enforced without implying all contents are read-only.

The navigation retains the approved 50ms hold without Hold/Menu or Example helper labels; no real-touch usability pass is claimed. Unread notifications appear as a badge on the collapsed input/menu button and a dot on the notification destination. Unavailable adapters keep preparation actions disabled; connected adapters require explicit preparation. Dark-mode readiness labels use opaque readable foregrounds.

Weekly schedules have explicit weekday. Time basis is the device timezone at save, with local next-occurrence preview; this is not a promise of closed-PWA wakeup. The preview helper advances local wall-clock dates (including platform DST normalization). Arbitrary timezone selection/conversion and DST ambiguity controls are not established. A changed device zone requires schedule review, not silent execution in a new zone.

Settings panels use a single Back/title/settings-file toolbar, consistent card spacing and choice sizes, and the same light/dark states. Appearance presents Theme, Background and Glass in separate cards matching model-role cards. Local files omits the file shortcut because it has no corresponding preferences record.

## Schedule conditions and model registration
All model roles share Add model -> registered choices, backed by the models preference record. Adding selects a catalog entry without downloading assets or asserting readiness.
Schedule editing supports Once (local date/time), Every day, Every week (one or more weekdays), Every month (day 1–31), and Custom (1–365 days/weeks anchored to a local start date). New schedules default to Once. Past one-off times, invalid dates, empty weekdays and invalid intervals are rejected. Monthly dates absent from a month are skipped, as stated in the UI. Custom intervals use calendar dates rather than elapsed 24-hour multiples. Time zone is the device zone captured at save; arbitrary-zone evaluation and DST ambiguity controls remain pending.
Prompt bytes survive repeat-sheet transitions, save and re-edit. Conditions live in the canonical task body and occurrence cursor rather than filenames. Schedule, Memory, execution logs and notification views must resolve the same IDs and retained revisions. This does not establish OS delivery.

## Text sizing and composer geometry (Unit89)
App-owned text sizes use rem relative to the browser base instead of fixed px. Standard16px-base text retains its prior nominal sizes. Attachment/voice icon hit boxes are44x44px like Send. Composer line height follows text size; field-sizing:content progressively grows the input to its viewport cap where supported, with internal scrolling beyond it. A ResizeObserver reserves the measured composer height plus spacing in conversation content, keeping the default minimum/safe-area padding. Action rows may wrap. Existing glass palette, navigation structure and protected device runtime are retained.

PC acceptance uses a controlled root font-size32px at320x640 to exercise text reflow, not a claim of Safari Dynamic Type or browser/OS zoom equivalence. Physical IME, touch, voice/camera, different zoom modes and device font settings still require real-device checks. Unsupported field-sizing retains the scrollable native textarea fallback. No accessibility certification or emergency-use safety guarantee is made.
