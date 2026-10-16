# Local attachment and decision harness contract

## Scope

The prototype now previews multiple local attachments, reads UTF-8 TXT/Markdown up to 1 MiB, displays images and offers browser-native audio/video playback. It preserves attached originals alongside sent input for the current session. It does not persist, index, transcribe, OCR, analyze media or run models. Media capability statuses stay Not prepared; unknown formats and PDF extraction are Unsupported. Browser codec support still determines playback.

## Production record contract (not integrated)

An original asset needs stable ID, immutable revision, MIME/size/hash, original name and local blob storage identity. Derived representations reference the exact asset revision, extractor/model revision, processed ranges and partial/error status. Text locations use explicit offset encoding; PDF locations use pages and normalized regions; audio/video use start/end milliseconds and optional frame/region. A corrected transcript adds a revision; prior summaries keep their original dependency identities and can be marked stale.

Decisions select among explicitly available tools: save original, read text, retrieve, inspect image, transcribe, inspect video, generate, propose bounded edit, or ask for a missing decision. Only verified installed capabilities are available. Open d1 is a candidate decision model, not implemented routing, OCR or transcription. No filename/document/model output grants write/delete authority. Ask only when missing information materially blocks the task; default reversible capture can use Inbox. Ambiguous existing-record modifications require review.

Pipeline: validate original -> interpret intent -> validate capability and authorization -> process required ranges -> store derived result/provenance -> retrieve evidence -> generate -> validate reference identities/ranges/quotes. Structural citation validation cannot prove the correctness of media interpretation. Do not assert that unprocessed video/audio was understood. No silent downloads, remote processing or provider fallback.

Long operations need cancellable chunks, progress and resumable checkpoints. Asset/capability missing is distinct from unsupported format and processing failure. Production asset size/storage quota policies and decoder/model budgets must be measured before enabling broad media import.

## UI contract

The composer uses one attachment + and a separate voice action. Pending items can be inspected or removed. Send groups text and originals; it does not invent a model response. Original previews display the real status. Future citations open exact source ranges, page regions or time spans; no media citation is fabricated by the current prototype.

Settings: independent Text/Decision selection; Media capability readiness; Appearance theme/background/glass presets/reset; Connection permission; Local files backup/restore/Trash. Appearance is local session state in the prototype. Not-prepared media capabilities have no fake Prepare action.

Notifications: save receipts are actual preview events with title/body/timestamp/read state and linked schedule ID. Opening detail marks read. Opening source resolves the same schedule object; deleting a notification never deletes its schedule. These receipts are not evidence of timed execution or OS delivery. Canonical Memory-backed notification records remain integration work.
