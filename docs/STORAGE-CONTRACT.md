# Storage contract — implementation and accepted design

This document describes the actual baseline in dist/. The accepted Home/protected-root/tool/schedule design is in PRODUCT-SPEC.md and is not yet integrated into baseline storage. In particular, the current baseline uses lowercase inbox/default ID filenames, does not enforce the prototype's five-root/five-level policy, and does not expose model-originated editing tools. Preserve compatibility and write an explicit migration/authorization plan before changing those contracts.

The design/prototype/ harness uses transient React state only. Home/Files are navigation mappings, not OS files. Its helper validation is not a replacement for transaction-level enforcement in the production store.

## Baseline behavior (preserved implementation)
# Local knowledge storage contract

Build: 0.2.0-local (2026-10-17). IndexedDB `mlb-memory-v1`, `notes` store is canonical. The Markdown tree is a projection of saved version paths. It does not claim that Markdown files exist in OPFS or the OS filesystem. OPFS `mlb-assets-v1` is only for pinned inference assets. No database reset or destructive migration is performed.

Each record has a permanent ID, kind, state, aliases, source references and an append-only revisions array. A revision has version, title, exact body, timestamp and optional path. Edits and rename/move use optimistic expected-version checking inside a read/write IndexedDB transaction. Path and body edits create one revision together. Earlier bytes and paths remain available in History. References retain note ID, revision and UTF-16 start/end plus exact quote. ID links survive moves. Withdrawals retain the entire record; withdrawn and stale-derived evidence cannot ground answers.

New paths are NFC-normalized, relative, slash-separated and end in `.md`. Traversal, empty segments, backslashes, control characters, Windows reserved device names, trailing dot/space and nonportable filename characters are rejected. Current paths are reserved case-insensitively, including withdrawn records. Duplicate paths and file/folder prefix collisions abort a save. Old historical paths are not reserved after a move. Default paths are `inbox/<sanitized original title>-<full ID>.md`. Legacy revisions lacking a path use that same stable projection from the FIRST title and ID; viewing or exporting never rewrites them. A later correction adds a path only to its new revision.

The Input surface accepts literal capture/search/read routes without inference (e.g. `Remember ...`, `記録：...`, `Search ...`, `Read projects/file.md`). Other natural-language phrasing is classified by the selected, local Bonsai. Capture always opens a review dialog before creating a record. Literal capture preserves the payload; model-classified capture conservatively preserves the entire request and `capturedFrom`. Existing records can only be edited through the user's explicit editor. No model action updates, withdraws or deletes a record. Generated answer saving reuses that exact result, opens a review dialog, verifies current source references again and creates a new ID; it never regenerates.

## Local file exchange

- **Export Markdown** exports the selected revision as UTF-8: YAML front matter containing a JSON `babelshelf` object with ID, version, path, state, kind and source refs, followed by the exact saved body. This is an inspectable single-file projection, not a complete historical backup.
- **Export backup** produces a local `.brainpack` JSON file, schema 1, with all records, complete revisions (including paths), withdrawal state, aliases and sources, plus SHA-256 of the JSON payload. This is the complete knowledge backup. It excludes result history, drafts, settings, model and runtime assets.
- **Import TXT/MD** preserves the entire decoded UTF-8 file as the body of a NEW original record with a new ID and collision-resistant inbox path. Exported front matter is literal on reimport; import is not identity restoration.
- **Restore** verifies digest/schema/references first. Exact identical IDs are skipped; differing same-ID records are kept locally and reported as conflicts. No conflict is overwritten. Invalid cross-record source references or incoming current-path collisions abort the entire transaction. Use a separately created copy or manually edit/move a local record before retrying; there is no automatic conflict resolution.

## Offline and update contract

Downloads default OFF on each app boot. Only explicit model preparation and update checks allow remote asset retrieval. Inference fetch is denied except the in-memory local GGUF reader; turning downloads ON does not transmit personal content. The service worker verifies every app-shell asset before publishing its cache and returns an explicit missing-asset response rather than fetching missing assets during ordinary use. Model/runtime are size- and SHA-256-checked during preparation and again on load. The runtime-specific license is unresolved and is not inferred from the model Apache-2.0 license or redistributed in the repository.

The build and shell cache can be checked in Settings > Diagnostics. Existing installed workers require explicit update and closing every controlled page before reopening. Reindex only rebuilds derived search data. Browser storage eviction remains possible; export a local backup. This contract does not assert an iPhone or full offline PWA acceptance pass.
