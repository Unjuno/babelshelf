# BabelShelf — local knowledge PWA

A smartphone-oriented, local knowledge interface inspired by GBrain. Stored knowledge is the source of truth; models are interfaces for operating on it.

**The usable offline MVP is not complete.** Canonical storage and actual PC Bonsai4B inference are now connected. Current production entry and measured limitations: [MODEL-RUNTIME-VERIFICATION.md](docs/MODEL-RUNTIME-VERIFICATION.md).

Local backup now includes canonical records, original dialogue, folder/Trash metadata, correction receipts and newly persisted attachment originals in an atomic schema2 snapshot. Restore previews conflicts and refuses stale or conflicting full-state writes. Model/runtime assets and unsent/legacy unpersisted originals are excluded; divergent destination data still needs manual reconciliation. Current backup files are bounded to200MB; larger collections require future partitioned export. See [BACKUP-CONTRACT.md](docs/BACKUP-CONTRACT.md).

PDF text-layer extraction now preserves exact raw originals, page/range metadata and original-page citation previews. See [PDF-CONTRACT.md](docs/PDF-CONTRACT.md); image-only pages remain unprocessed by OCR.

Continuous Input now persists local dialogue and passes prior context to routing and answering. Long history is compacted with the same local model, retaining original turns and bounded original-excerpt recall. See [CONVERSATION-CONTRACT.md](docs/CONVERSATION-CONTRACT.md). Canonical foreground task/event integration is described in [SCHEDULE-CONTRACT.md](docs/SCHEDULE-CONTRACT.md); whole-MVP acceptance remains pending.

Harness/prompt diagnosis uses fixed public inputs and the actual prepared local model in an explicit developer route, separate from the accepted UI. Reproducible reports, failure boundaries and literal read-only operation design: [HARNESS-EVALUATION.md](docs/HARNESS-EVALUATION.md).

Ordinary-note model corrections now open a Before/After review. Explicit Save checks the expected canonical record and atomically appends a revision and receipt; History Undo appends another revision. Actual PC4B review, Cancel, competing-tab conflict rejection, reload and Undo have been exercised. The adapter supports bounded literal replacements/splitting and source-only semantic body proposals with full review; system/task model edits remain pending. See [CORRECTION-CONTRACT.md](docs/CORRECTION-CONTRACT.md). One manual foreground scheduled generation, citation, notification and exact-result save also passed; closed-PWA wakeup is not supported.

Run `npm run build:app`, then `node scripts/serve-product.mjs 4180` for the native-browser PWA at http://127.0.0.1:4180/. This static server never runs inference. The protected phone preview remains independently runnable. Downloads reset OFF on boot; explicit model preparation is required. The production shell uses verified caches and explicit update controls. Older surface descriptions below are retained for development reference; the linked verification document takes precedence.

There are also two development/reference surfaces:

| Location | Purpose | Current limits |
| --- | --- | --- |
| `dist/` | Shared IndexedDB, immutable revisions, sources, search, backup and pinned Bonsai worker; older baseline UI | The accepted production entry is built separately; baseline Node checks are not device acceptance |
| `design/prototype/` | Accepted UI, canonical records, dialogue, reviewed corrections/Undo, foreground tasks/events, local inference and state brainpack; separate `product/` native PWA entry | Remaining OCR/video-frame extraction, system-record edits, broader attempt integration, large archive/device recovery and offline/device acceptance remain pending |

Read [the accepted product specification](docs/PRODUCT-SPEC.md) and [integration plan](docs/IMPLEMENTATION-PLAN.md). Do not carry the old bottom-toggle layout into the new UI simply because baseline source checks still cover it.

## Start the accepted UI

Node.js **22.18+** or a compatible newer version; this handoff was checked with Node 24.6.0.

```sh
npm --prefix design/prototype ci
npm run dev:prototype
```

Open http://127.0.0.1:4180/. The command binds to localhost. If occupied:

```sh
npm --prefix design/prototype run dev -- --host 127.0.0.1 --port 4181
```

The phone frame/keyboard are browser simulations. There is no fixture conversation. Remember/記録, Search/検索 and Read/読んで use real local records. Capture opens a review before saving. Text attachments become new originals. Notes, Settings, dialogue and foreground tasks/events persist in IndexedDB. Actual prepared Bonsai4B inference has been exercised in the separate production entry at4180; each origin needs its own prepared assets. Decision entries remain candidates; prepared local speech/OCR/PDF processing has scoped PC evidence. Submitted originals persist; playback alone does not imply model extraction. See the verification document for measured flows and remaining gates.

## Start the baseline PWA

No npm installation is needed for the plain-JavaScript baseline:

```sh
npm test
npm run check
npm run dev
```

Open http://127.0.0.1:4173/. Optional isolated origin: `npm run dev -- --port 4174`.
The server never runs inference. Existing Service Workers may retain an older build; use explicit update/close/reopen or a separate localhost port rather than deleting existing data.
For physical iPhone PWA tests, use a secure top-level HTTPS origin. A LAN HTTP URL is not equivalent.

## Verification

```sh
npm test
npm run check
npm run test:markdown
npm run test:prototype
npm run build:prototype
```

See [measured results and outstanding gates](docs/TEST-RESULTS.txt). Node/source checks and phone simulations do not establish usable GPU inference, real IME, accessibility compliance or offline cold restart.

## Repository map

- `dist/`, `tests/`, `scripts/`: baseline PWA, core tests and localhost server.
- `design/prototype/`: portable accepted UI source, dependency lockfile and protected phone runtime.
- `docs/PRODUCT-SPEC.md`: current product/UI/storage/tool/scheduling decisions.
- `docs/IMPLEMENTATION-PLAN.md`: work remaining to integrate the MVP.
- `docs/STORAGE-CONTRACT.md`: actual baseline persistence/export contract and accepted changes still pending.
- `docs/design/`: selected browser screenshots, with their validation limits.
- `research/`, `dist/model-manifest.json`: upstream metadata and pinned baseline asset identities.
- `specs/pending/`: historical acceptance seeds; the Markdown seed now passes.

No model weights, downloaded inference runtime, private user notes or credentials are included. Baseline notes/settings are in IndexedDB and model/runtime assets in OPFS. The third-party inference runtime's redistribution license remains unresolved. No deployment is performed by this handoff.

Attachment/decision processing contracts and current limits: [MEDIA-HARNESS.md](docs/MEDIA-HARNESS.md). Explicit Send stores original bytes, canonical projections and input atomically; reopening resolves verified originals without file reselection. TXT/MD decoding and raw byte provenance are connected. Prepared OCR/transcription/PDF extraction is connected, including automatic Send processing. General scene/video-frame understanding remains unprepared; native playback does not imply model understanding.

Browser storage is origin-specific: 4173, 4180 and 4181 do not automatically share IndexedDB. Use local backup/restore to transfer between origins. The adapter uses the existing mlb-memory-v1 schema without clearing it. The 4180 development server now serves repository source, not the older outputs copy.

Local speech: Whisper tiny has explicit verified preparation, local WASM recognition and original-linked reviewed transcript notes. See [speech contract](docs/SPEECH-CONTRACT.md) for current bounds, actual evidence and remaining phone/accuracy gates.

- Local PNG/JPEG OCR now has pinned Tesseract runtime/language assets, explicit preparation, reviewed atomic raw/derived storage and region-aware source metadata. Read docs/OCR-CONTRACT.md. Japanese sample recognition had errors; do not claim broad accuracy. Prepared image/PDF-plus-question input is connected. Empty PDF pages now use prepared-only local OCR with original-page provenance; see PDF-CONTRACT.md. Video vision and physical-device/full-offline acceptance remain pending.

- Reviewed OCR/PDF Use text now stages an attachment without changing the draft; Send imports raw/extracted notes and dialogue together, matching TXT/MD behavior. Current-file grounding includes mixed readable attachments, excludes raw-projection prose and historical pins, and refuses changed/withdrawn or oversized scopes. Read docs/INPUT-READINGS.md. Pending drafts before Send are not durable.

Ordinary Send now runs already prepared local PNG/JPEG OCR, PDF text-layer extraction and supported audio/video-audio transcription before atomic raw/extracted/dialogue import. Automatic results are labelled extracted rather than human-reviewed; missing assets never download implicitly. See [INPUT-READINGS.md](docs/INPUT-READINGS.md) for Stop, partial coverage, current-file grounding and remaining limits.


- Optional Open d1 Omni 600M now has a pinned isolated local text-decision adapter, with explicit preparation, native WebGPU execution and worker lifecycle. See [DECISION-CONTRACT.md](docs/DECISION-CONTRACT.md). Text graph preparation does not install media encoders, and finite decisions do not authorize writes. Selected prepared D1 now classifies current intent in ordinary Send; bounded read-only routes can proceed directly, while structured and context-dependent retrieval requests retain Bonsai planning. Full context, source validation and approval stay in the harness; phone/full offline acceptance remains open.
