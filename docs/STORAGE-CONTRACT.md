## Reviewed file creation (Unit51)

New notes and Save note reuse the exact reviewed body/kind/source references; saving never invokes inference. A synchronous same-page gate spans canonical creation and the originating dialogue acknowledgement. File fields, tabs, dismissal and repeat Save are blocked during that interval, as are new same-page foreground task claims. Canonical source/path/identity validation still rejects cross-tab conflicts.

Creation and dialogue acknowledgement are separate commits. If creation fails, the draft remains editable and no Saved acknowledgement is written. If the canonical note commits but the originating turn's CAS fails, creation is not retried: the review closes, the committed ID opens and a note-specific Saved/conversation-status warning appears. The other tab's dialogue remains authoritative; no overwrite/rebase is attempted. Opening a different file does not inherit that warning. The original turn may retain its prior review status after an acknowledgement conflict; reconciling it is not automatic. Existing canonical history and data are never reset to recover the UI.

## Product selected-revision Markdown export (Unit44)

The accepted product exposes Export Markdown in File actions and each expanded History revision. The action captures the displayed canonical ID/version and reads that exact retained revision through a readonly notes transaction. It never substitutes the latest revision. Protected records may be exported without enabling Edit/Delete. The UTF-8 filename includes `.v<version>.md`.

The single-file projection contains the exact saved body and JSON-valued `babelshelf` front matter: ID, selected version/historical path, current record state/kind/sources, immutable original references and retained extraction/transcription metadata where present. Extraction metadata describes the retained extraction; it does not certify alignment to a subsequently edited body. Raw binary assets, other records and complete revision history are excluded. Missing versions and text that cannot roundtrip UTF-8 fail explicitly. Export has no model/network/write authority. Importing this Markdown remains new literal content, not identity restoration; use schema2 brainpacks for full-state backup.

## Working file selection

Optional dialogue.currentFile stores only canonical note ID and viewed revision; it is not a disk file or a duplicate body. Focus selection and turn updates share one serialized writer with expected-dialogue CAS, persists across Input navigation/restart and is included in schema2 brainpack. Backup validates the original revision link, including retained withdrawn history. Execution additionally requires the current active version. No notes/revisions are removed or rewritten to introduce this optional field. See CONVERSATION-CONTRACT.md Unit33.

## Current state backup integration

The accepted product now exports checksummed schema2 brainpacks from one atomic notes/settings/runs snapshot, including original dialogue, empty folders/Trash metadata, correction receipts and newly submitted attachment originals. Full-state conflicts cause zero writes; whole-state expected snapshots reject stale approval. Historical schema1 note-only files remain readable but cannot carry new asset-linked notes without original bytes. Newly imported schedules require review and downloads-ON preferences append OFF. See BACKUP-CONTRACT.md for exact encoding, exclusions and size/conflict limits. Earlier backup/persistence status statements below are historical and superseded by this paragraph; model/runtime assets, derived media extraction, larger-archive export and fresh-device conflict reconciliation remain pending.

## Reviewed correction integration

Ordinary-note model proposals and finite typed patches to existing registered schedules use explicit Before/After review, whole-record expected checks and notes+runs atomic revision/receipt persistence. History offers revision-based Undo with stale-target rejection. Task cursor changes also invalidate pending approval/Undo; model patches cannot change activation/timezone or clear restored-task quarantine. See CORRECTION-CONTRACT.md for exact limits. Dedicated schedule/event persistence is documented in SCHEDULE-CONTRACT.md; older pending statements below are chronological.

## Production engine/shell update — 2026-10-17

The separate product entry uses native browser controls with the same UI and canonical adapter. The protected phone runtime is unchanged. Shell install verifies bundled assets; ordinary missing resources return503 without fallback. Inference uses OPFS and denies default fetch; explicit preparation alone can fetch pinned assets. Downloads reset OFF at boot via a retained connection-record revision. App updates verify a new cache and preserve IDB/OPFS; they ask to reopen rather than discarding a live draft automatically.

Generated-result saving now uses the existing answer bytes and sources in a review, creates a new generated ID and rejects sources changed before commit. No regeneration occurs. Literal Answer/Summarize routes complement actual Bonsai classification. See MODEL-RUNTIME-VERIFICATION.md for measured scope and limits. Persistent schedules, notifications, media and complete auxiliary-state backups are still pending.

## Current integration — 2026-10-17

The accepted UI now uses the existing `mlb-memory-v1` notes store through `design/prototype/src/knowledge-store.ts`. Baseline JS core remains the source for record creation, revision, search, reference validation and backup. It opens schema1 unchanged; no data reset. Only missing built-in Tools/Settings records are initialized. Static sample conversation/notes have been removed. Legacy lowercase paths, IDs, revisions, sources, aliases and unknown metadata remain byte-for-byte until an explicit edit.

UI fields are projections of canonical revisions. Writes are serialized, committed atomically after expected-record checking against actual IDB state, and enforce path uniqueness, five-level new paths, settings identity/value validation and read-only built-ins. A stale tab receives a conflict and reloads actual records; the edit form remains open. Saved is shown only after transaction completion. Deletion withdraws and appends a revision; restore reactivates through another revision. Recovery UI batches and empty folders use namespaced settings keys. Orphan withdrawn notes are recovered into Trash after interrupted metadata writes. These auxiliary writes are not an atomic full-state backup yet.

TXT/MD originals sent from the composer are bounded UTF-8 decoded (1MiB); new IDs, exact body, original filename and byte count are retained under Attachments. Input literal capture opens confirmation; search rebuilds the baseline derived index from actual records. Sources pin ID/revision/UTF-16 range/quote and opening them checks exact bytes. General natural language and generation still require the model integration.

Settings > Local files now exports/verifies/restores the existing schema1 brainpack, including every canonical note, revision, state and settings Markdown record. Conflicting IDs keep local records and report conflict counts; path/reference errors abort the transaction. This backup does not yet include empty folders/recovery batch metadata, media blobs, results or model assets. Schedule and notification records remain the next integration unit.

The preserved baseline contract and historical integration limits follow; where status differs, this current section takes precedence.

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

Reviewed speech used as a question stays in ui-v1-dialogue as source-linked working input. Sending creates only fresh original/projection records, or reuses an existing active original; it does not create a knowledge transcript automatically. Model provenance and raw-byte identities remain validated in schema2 backup even when no derived transcript note exists. Explicit Save note follows the separate atomic transcript contract.


## Atomic folder rename (Unit42)

Memory folder rename appends canonical path revisions and updates explicit/empty descendant folder metadata in one IndexedDB notes/settings transaction. Source IDs, original bodies and earlier paths remain intact. It compares the exact affected projected records and subtree membership plus the committed folder-metadata snapshot, recomputes depth/collision/protection checks, and refuses concurrent changes. Local queues drain first; the rename is reserved before awaiting. Metadata is hydrated only after commit, suppressing a duplicate effect write. A failed transaction leaves both notes and empty folders unchanged. Native forced-write-failure QA is transaction rollback evidence, not a real quota-exhaustion test. File path editing remains versioned through the existing canonical save path.


## Atomic deletion and Trash recovery (Unit43)

Memory and notification deletion use one notes/settings transaction to withdraw canonical notes, retain their complete history, store the recovery batch and update empty-folder metadata. Recovery validates the exact stored batch (or a canonical-derived recovered tombstone), compares the retained withdrawal's body/path/history and optional historical paths, then revives canonical records with an appended revision. A later edit/delete cycle invalidates stale batches. Both operations compare affected content/subtree membership and committed folder/Trash metadata before writing. Protected roots, managed/bundled records, running logs, depth/path reservations and collision rules remain authoritative.

Local queues drain before the synchronously reserved operation. Metadata is hydrated after commit, including derived legacy display batches without writing them on hydration. Undo is tied to the committed deletion ID rather than Trash array order. Native injected metadata-write failure after note/folder writes proves real transaction rollback, not a real quota-exhaustion pass. No record/original/history is purged.

## Bundled tool source projections (Unit76)

Canonical records also accept TypeScript source paths `Tools/<lowercase-package>/<lowercase-source>.ts` and `Tools/tool-host.ts`. Normal user file creation remains Markdown-only. Bundled packages seed protected source records and SKILL.md from raw imports of the compiled source inputs. These remain IndexedDB text projections, not physical installed files, and never execute through their stored bodies. Imported text never registers an adapter or grants capabilities. Existing seed identities are not overwritten on startup; retained historical/imported snapshots are not proof of the executing bundle identity. Future package revisions require explicit append-only migration/version handling.

Single source exports use UTF-8 body bytes without Markdown frontmatter, with a `.vN.ts` filename; use a brainpack for IDs/history/metadata. Ordinary Markdown exports retain frontmatter. New .ts paths extend the storage contract: older clients may reject them. No historical data is deleted to introduce these records.

## Device storage observations and explicit protection (Unit92)
Settings > Local files exposes browser-reported origin usage and quota-minus-usage as estimates, plus persisted() status. Initial preparation displays the same estimated available amount beside its existing up-to asset total. Unknown, absent, rejected or nonfinite measurements stay Unknown; they are not zero, physical disk free space, RAM, exact acquisition budgets or model readiness. Insufficient-capacity admission is not inferred from a partial-cache total.

Protect storage invokes navigator.storage.persist() only through an explicit user click. Opening settings/preparation only reads estimate()/persisted(). The request can be unsupported or denied. UI status follows a fresh persisted() observation, never a requested flag or restored setting. A denied request displays Not granted and retains ordinary best-effort operation. No browser-protection preference or claimed grant is written into canonical Memory/settings/runs or restored from a backup. This is a browser-controlled storage property, not a permission to fetch/run models or mutate data. No cleanup/purge follows a denied request.

A Persistent status is not a guarantee against user clearing, uninstall, browser/OS actions, device loss or every eviction condition. Local file backups remain independent and exclude model/runtime assets. Phone quota pressure, actual eviction behavior and full offline installed-PWA retention remain unverified. The current browser may expose different subsets of these APIs; controls are feature-detected.

## Saved-result discovery (Unit99)
Interactive saved-record search now uses a separate stored-note index, including active source-free generated notes and generated notes whose ancestors changed. This lets a reviewed saved calculation/answer be found again after restart without changing its kind, sources or provenance. Results retain actual canonical ID/version/UTF16 ranges and derive a groundingEligible status from the current source graph. A false status displays No current source. The flag is display metadata, never authority or a substitute for revalidation.

The evidence index/search used by groundedAnswer and current-file evidence remains strict and separately cached. Discovery results do not become grounded knowledge merely because the user found or opened them. New generated saves still validate transitive current sources; withdrawn notes remain excluded from discovery. Search is a read-only tool invocation and all prior histories remain. This change covers stored textual bodies; binary files with empty projection text still use Memory browsing/original attachment routes.


Unit145: direct editor duplicate Save bug reproduced/fixed. Actual normal UI two button.click calls in one task on productc7598e2dd2e89020 appended duplicate identicalv2/v3; strict expected2versions fails with3. New synchronous directSaveLock prevents another entry before React redraw; editSaving disables Path/body/Save/Cancel while pending, capturedID/body/path/version defines the queued write and live queue version rechecks before append. Await commit/failed draft behavior retained; lock releases in finally for explicit later edits. No default/model/history migration. Product0e3efd0c6b6af729/112. Native green first duplicate yields onlyv2 with exactv1 retained; later explicit edit succeeds asv3 and History has exactly3versions. `node scripts/qa/direct-save-duplicate.mjs NEW_OUTPUT NEW_ABSOLUTE_PROFILE` exit0 in outputs/unit145-direct-save-history. Earlier outputs/unit145-direct-save-final failed only because observer counted History summaries before async sheet opened (screen confirms intendedlatereditv3); driver now waits visible. OriginalRED and basicGREEN remain unit145-direct-save-red/unit145-direct-save-green. Actualwrites only normal UI, IDB read-only audit, no inference/mock/DBseed. Prototype367/product2/build/check31/protected28 pass. Screenshots/history and evidence retained. PC native scope, not phone/OS isolation/quota recovery. Goal incomplete.
