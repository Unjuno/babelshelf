# BabelShelf — local knowledge PWA

A smartphone-oriented local knowledge interface inspired by GBrain. Stored records and originals are the source of truth; models operate on them. The accepted UI is connected to canonical persistence and actual local inference. On 2026-10-19 the user accepted the published product as the completed baseline. The first [architecture rationalization](docs/ARCHITECTURE-RATIONALIZATION.md) is implemented and published: input preparation, commit acknowledgement and recovery have explicit ownership outside the UI. Acceptance does not turn unverified capabilities or device behavior into verified results.

Current evidence and exact build scopes: [MVP acceptance ledger](docs/MVP-ACCEPTANCE.md). Unresolved requirements: [remaining gates](docs/REMAINING-GATES.md). Intended behavior: [product specification](docs/PRODUCT-SPEC.md). Do not use historical prototype-status paragraphs or old comparison results as the current design.

Current runtime, ownership and dependency boundaries: [application architecture](docs/ARCHITECTURE.md). The original [`ARCHITECTURE.txt`](docs/ARCHITECTURE.txt) is retained as a historical baseline.

## Run the native PWA locally

Use Node.js **22.18+** or a compatible newer version; development was checked with **24.6.0**. From the repository root:

```sh
npm --prefix design/prototype ci
npm run build:app
npm run dev:app -- 4180
```

Open http://127.0.0.1:4180/. This entry uses native browser controls and the verified installable PWA shell. The static server serves files; all inference runs in the browser. The build must finish before starting this server. No publishing or deployment is required for PC localhost use.

Downloads/updates reset OFF on boot. In Settings, register/select supported models and explicitly prepare/verify required assets before offline use. A catalog choice is not a working runtime; missing normal-use assets must fail locally instead of fetching silently. Existing Service Workers may retain an older build: use the reviewed update/reopen controls, not browser-data clearing. See [installation](docs/PWA-INSTALLATION.md) and [updates](docs/PWA-UPDATE-CONTRACT.md).

Browser storage belongs to the exact origin and profile. Ports 4173/4180/4181 and different profiles do not automatically share records or prepared assets. Use reviewed local backup/restore for knowledge transfer. Model/runtime assets are prepared separately. Physical iPhone installation needs an appropriate secure top-level origin; PC localhost success is not phone acceptance.

## Connected flows and boundaries

- Memory, preferences, tasks, execution records, notifications, dialogue and originals use canonical local storage. The Markdown hierarchy is an IndexedDB projection, not an OS directory. IDs, retained revisions, withdrawals, source locations, protected roots and five-folder depth are preserved. [Storage contract](docs/STORAGE-CONTRACT.md).
- Natural input connects capture/search/read/answer/summary, retained dialogue/compaction, reviewed corrections and exact generated-answer Save. Existing records cannot be overwritten by a model without approval. Known intent, language and summary errors remain. [Conversation](docs/CONVERSATION-CONTRACT.md), [corrections](docs/CORRECTION-CONTRACT.md).
- Bonsai4B is the default local text model. Users can add supported Qwen3.5/LFM2 GGUF text models, a fixed D1-ONNX text-decision package, and a fixed Whisper ONNX speech package through app-owned adapters. A real custom Whisper package has loaded and transcribed in PC Chrome with browser networking disabled, including after page reload; one short synthetic sample did not establish recognition accuracy. OCR is available through Tesseract. A separate pinned LFM2.5-VL 450M WebGPU adapter and Text + vision model preset support a single-image description path in code; real asset preparation/generation and image quality have not been verified in the current acceptance record. Video-frame understanding remains unsupported. Registration, local verification, actual loading and task quality are separate states; arbitrary GGUF/ONNX files are not universally compatible. [Models](docs/CUSTOM-MODELS-CONTRACT.md), [model role architecture](docs/MODEL-ROLE-ARCHITECTURE.md), [runtime evidence](docs/MODEL-RUNTIME-VERIFICATION.md).
- Prepared local Whisper tiny/base, Tesseract OCR and PDF readers preserve originals separately from extracted text. Whisper base preparation, local WASM transcription, reviewed Save and backup provenance were exercised in the Codex sidebar PC browser; this is not an iPhone or full network-isolation result. Automatic Send reads only available capabilities. Citations open details/media on demand. Video is currently audio-only; scene/frame understanding and exact video timing alignment are unsupported. [Media](docs/MEDIA-HARNESS.md), [speech](docs/SPEECH-CONTRACT.md), [OCR](docs/OCR-CONTRACT.md), [PDF](docs/PDF-CONTRACT.md).
- Schedules run while the page is visible. Attempts, interrupted/missed states, explicit Retry/Skip and pinned notification results persist. Deleting a notice preserves its task/result. Closed-PWA wakeup and offline OS delivery are not guaranteed. [Scheduling](docs/SCHEDULE-CONTRACT.md).
- Backups are local files with graph/hash validation and conflict refusal. Current state archives are bounded to200MB. They exclude model/runtime assets and unsent drafts; arbitrary divergent-history reconciliation and streaming archives remain absent. [Backup](docs/BACKUP-CONTRACT.md), [reviewed settings recovery](docs/SETTINGS-RESTORE.md).
- Bundled tool code and SKILL.md have inspectable source identities. User definitions do not grant execution; external MCP remains inactive. No cloud/LAN inference, account, personal-data upload or cloud sync is required. [Tool packages](docs/TOOL-PACKAGES.md).

Actual PC browser/installed-PWA evidence includes offline process restarts, real model generation, readers, correction, tasks and backup flows at their recorded builds. Android/iPhone hardware, OS-isolated all-function acceptance, real storage pressure and broad semantic accuracy remain separate gates. The pinned WebML runtime's own redistribution license remains unresolved; the model license is not substituted for it.

## Verification and work map

```sh
npm test
npm run test:prototype
npm run test:app
npm run test:markdown
npm run check
npm --prefix design/prototype run check:runtime
```

Run build:app before test:app. Node checks are not browser/GPU/device acceptance. Browser QA commands and original failures are recorded in [TEST-RESULTS.txt](docs/TEST-RESULTS.txt); scripts that require fresh profile/output paths must not reuse or purge existing data. Model comparison/tuning is not a default continuation task.

Read [NEXT-REQUIREMENTS.md](NEXT-REQUIREMENTS.md) and the [implementation map](docs/IMPLEMENTATION-PLAN.md) before new work. The current canonical adapter is in design/prototype/src; design/prototype/product supplies the native entry. dist/ retains shared baseline core/worker modules and a separate historical shell. Model pins include dist/model-manifest.json and adapter-specific manifests referenced by their contracts.

## Separate development/reference surfaces

The protected phone frame and simulated keyboard are a design preview. To run it on a separate origin:

```sh
npm --prefix design/prototype run dev -- --host 127.0.0.1 --port 4181
```

The independent baseline shell runs with npm run dev at http://127.0.0.1:4173/. Neither preview geometry nor baseline Node tests prove native smartphone behavior. Preserve the locked phone runtime and old canonical data when developing the product entry.

Physical-device preparation without public deployment: see [local HTTPS instructions](docs/LOCAL-DEVICE-HTTPS.md). The optional `dev:app:https` server delivers static app files only; inference remains on the device. Device-trusted certificate setup and actual phone acceptance are still required.
