# Local attachment and decision harness contract

## Scope

The accepted product now persists submitted originals, their Markdown projections and the input turn atomically in the existing database. It reads bounded UTF-8 TXT/Markdown, displays images and offers native audio/video playback after reopening. Local Bonsai can use the actual stored text/source ranges; image/audio/video content extraction is still Not prepared. Unknown formats and PDF extraction remain Unsupported. Playback success is independent from transcription/OCR/model understanding, and codec support depends on the browser. The earlier transient descriptions below are historical design notes.

## Current original storage

Explicit Send prepares immutable original records in the existing runs store under ui-v1-original-ID. Each contains schema/type, stable ID, revision1, original name, MIME, kind, byte count, SHA-256, timestamp and bounded base64 bytes. No database version reset, cross-database half-commit, runtime download or upload is involved. File chooser selection alone remains transient. Original records, new canonical notes and expected-dialogue append commit in one notes/settings/runs transaction; stale input, duplicate IDs or path collisions abort all writes.

Memory/Files is the existing Attachments projection. Every original has a canonical Markdown record with the same ID and an originalAsset reference. TXT/MD up to1MiB use fatal UTF-8 TextDecoder processing (including its normal BOM handling); the raw original bytes stay exact. attachmentText records processor utf-8-textdecoder-v1, exact asset ID/revision/hash, full byte coverage and canonical noteRevision1. Binary/unreadable originals have an empty first body and do not contribute invented searchable evidence. Validation always checks the original first body and required presence/absence of this provenance; later explicit corrections append revisions and do not alter that original projection.

Input descriptors keep the stable asset reference. After reopening, previews resolve originals lazily and verify identity/size/hash before creating a session object URL. Memory Open original and the opened source sheet use the same original. Save original downloads its exact bytes. Preview/navigation epochs prevent obsolete asynchronous reads reopening a closed sheet; pending removals are disabled during submission, and revoked URLs cannot be reused as cache hits. Older descriptors without durable originals remain Preview unavailable and require reselection; no bytes are fabricated to migrate them.

Current budgets:32MiB/file,64MiB per pending batch,16 attachments; text decoding1MiB. These are bounds, not phone memory/performance guarantees. SVG/HTML/XML are opaque files with no active document preview. Previewing is not an execution permission. Withdrawing a file retains its original for history/Trash and existing input references; no silent purge or storage reclamation is performed.

Schema2 brainpacks include these namespaced original records and verify the inner raw-byte hashes as well as outer checksum/provenance. Model/runtime assets and unsent originals remain excluded. Export and import share a200MB UTF-8 file budget; oversized export fails before offering an unrestorable file. Partitioned/streaming archives and explicit storage reclamation remain required for larger collections. See BACKUP-CONTRACT.md.

## Remaining derived-media contract

An original asset needs stable ID, immutable revision, MIME/size/hash, original name and local blob storage identity. Derived representations reference the exact asset revision, extractor/model revision, processed ranges and partial/error status. Text locations use explicit offset encoding; PDF locations use pages and normalized regions; audio/video use start/end milliseconds and optional frame/region. A corrected transcript adds a revision; prior summaries keep their original dependency identities and can be marked stale.

Decisions select among explicitly available tools: save original, read text, retrieve, inspect image, transcribe, inspect video, generate, propose bounded edit, or ask for a missing decision. Only verified installed capabilities are available. Open d1 is a candidate decision model, not implemented routing, OCR or transcription. No filename/document/model output grants write/delete authority. Ask only when missing information materially blocks the task; default reversible capture can use Inbox. Ambiguous existing-record modifications require review.

Pipeline: validate original -> interpret intent -> validate capability and authorization -> process required ranges -> store derived result/provenance -> retrieve evidence -> generate -> validate reference identities/ranges/quotes. Structural citation validation cannot prove the correctness of media interpretation. Do not assert that unprocessed video/audio was understood. No silent downloads, remote processing or provider fallback.

Long operations need cancellable chunks, progress and resumable checkpoints. Asset/capability missing is distinct from unsupported format and processing failure. Production asset size/storage quota policies and decoder/model budgets must be measured before enabling broad media import.

## UI contract

The composer uses one attachment + and a separate voice action. Pending items can be inspected or removed. Send groups text and originals; it does not invent a model response. Original previews display the real status. Future citations open exact source ranges, page regions or time spans; no media citation is fabricated by the current prototype.

Settings: independent Text/Decision selection; Media capability readiness; Appearance theme/background/glass presets/reset; Connection permission; Local files backup/restore/Trash. Appearance is local session state in the prototype. Not-prepared media capabilities have no fake Prepare action.

Notifications: save receipts are actual preview events with title/body/timestamp/read state and linked schedule ID. Opening detail marks read. Opening source resolves the same schedule object; deleting a notification never deletes its schedule. These receipts are not evidence of timed execution or OS delivery. Canonical Memory-backed notification records remain integration work.

Bundled configuration and its actual consumers: see SETTINGS-CONTRACT.md. Harness policy in configuration is not an implemented execution adapter.

## Attachment source choice

On a fine-pointer desktop, composer + opens multi-file selection directly. On primary coarse-pointer devices it opens the common glass sheet: Take photo / Choose files / Cancel. Photo uses a separate single image input with capture=environment; file selection stays multiple and does not request capture. Both feed the same attachment inspection/removal/send path. Native camera behavior depends on the browser/device and requires physical-device verification; the phone preview preset alone is not hardware detection.

## Reference preview surface

ReferenceCard.tsx is the shared text/image/video/audio file-preview renderer. A future grounded answer must supply verified record ID, exact revision/range/time span separately; a URL/name in this UI is not provenance validation. Current example answers use a pinned bundled note v1. User media is only attached originals, labeled as such. Native playback is independent of transcription/OCR readiness. No test-generated transcript, answer or media-derived citation is substituted for real inference.

Answer citations stay compact inline marks. Filename, revision, original excerpt and media preview belong in the opened source surface, not a permanently visible answer card. User-sent attachment previews remain visible with their input.
