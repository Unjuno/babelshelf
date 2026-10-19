# Current requirements and next work

Updated 2026-10-19 JST. The user accepts the published product as the completed baseline. The active work is [architecture rationalization](docs/ARCHITECTURE-RATIONALIZATION.md), not an open-ended completion campaign. Preserve the accepted UI and stored data; do not restart historical model comparisons or rebuild connected features as preview state. Remaining evidence gaps below retain their scope, but are not additional acceptance conditions imposed on this refactor.

## Read in this order

1. [Accepted product/UI behavior](docs/PRODUCT-SPEC.md).
2. [Current evidence and exact build scopes](docs/MVP-ACCEPTANCE.md).
3. [Remaining gates](docs/REMAINING-GATES.md).
4. [Implementation map](docs/IMPLEMENTATION-PLAN.md), the relevant operation contract, and [original test results](docs/TEST-RESULTS.txt).

Historical unit notes and research reports are observations at their recorded build, not current requirements. Earlier versions of this handoff remain in Git history; detailed failures remain in TEST-RESULTS.txt and research/.

## Connected implementation

The native product entry shares the accepted UI with a canonical IndexedDB adapter. Notes, settings, tasks, executions, notifications, folder/Trash metadata, dialogue and processing receipts persist locally. The Markdown hierarchy is a projection; explicit exports and backups create separate local files.

Natural input connects capture/search/read/answer/summary, retained dialogue/compaction and reviewed corrections. Exact generated-answer Save does not regenerate. Shared source/record checks refuse stale approvals and unapproved overwrites. Source correctness and semantic intent still have known failures; one successful generated answer is not general reliability.

Actual PC evidence exists for Bonsai4B, local Whisper tiny, Tesseract OCR, PDF text/prepared empty-page OCR and video audio transcription. Automatic Send uses only prepared readers. Original bytes, derived results and source locations are distinct. A pinned LFM2.5-VL 450M WebGPU adapter and Text + vision preset exist for single-image description, but actual asset preparation/generation and image quality are not verified; video-frame understanding remains unsupported. Newly processed single-track WebM/MP4 audio has validated container offsets and estimated transcript segments; actual PC installed offline flows are recorded in VIDEO-TIMELINE.md. Legacy transcripts and edited text retain broader source coverage.

Text, Decision, Speech, OCR and Vision are independent roles. Bonsai4B remains the default. Supported custom Qwen3.5/LFM2 GGUF text models and fixed-contract D1 text-ONNX models can be added through app-owned adapters. A bounded eight-file Whisper ONNX package was loaded and transcribed in PC Chrome with browser networking disabled, including after a page reload. The one short synthetic sample produced text whose accuracy was not established. Custom OCR/image-description/video-frame model imports and arbitrary GGUF/ONNX or D1-3B multimodal support remain absent. Extensions alone do not prove compatibility. See [custom model contract](docs/CUSTOM-MODELS-CONTRACT.md).

Bundled tools execute validated code and expose SKILL.md/source identity. Custom definitions and external MCP remain inactive; the file itself never grants execution/network permission. See [tool packages](docs/TOOL-PACKAGES.md).

## Next work and limits

- Complete Android/iPhone physical PWA acceptance and OS-disconnected cold restart when the devices/environment are available. PC standalone/browser-offline and synthetic touch/media remain separate evidence.
- Resolve the pinned WebML runtime's own redistribution provenance. Model Apache-2.0 and dependency MIT are not a runtime grant. User-authorized public Sites publication is recorded in SITES-DEPLOYMENT.md; the WebML runtime itself is excluded and acquired directly only through explicit preparation.
- Address concrete normal-use semantic failures structurally. Do not resume broad model/prompt benchmarking, tune until a fixture passes, fabricate inference or silently select another provider.
- Verify actual quota/eviction/interruption behavior. The controlled abort tests and ineffective CDP quota override are not real capacity-failure evidence. Do not alter global disk policy or purge knowledge/assets.
- Keep the documented200MB backup bound, add-only conflict rules and reviewed recovery scope explicit. Streaming/partitioned archives and arbitrary divergent-history/dialogue reconciliation remain absent.
- Keep foreground scheduling and in-app notifications truthful. Closed/suspended-PWA wakeup or offline OS delivery is not guaranteed.

Use [REMAINING-GATES.md](docs/REMAINING-GATES.md) for evidence needed and [IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md) for flow-level checks. Fix a concrete unmet requirement or demonstrated defect; do not repeat passing samples or add tests merely to increase counts.

## Invariants

No cloud/LAN inference, personal-data upload, silent acquisition, account/sync service, database reset or unauthorized model overwrite/delete. Preserve IDs, all original revisions/paths, withdrawal state, protected roots and maximum five stored folder levels. Check the actual SW build without deleting existing browser data. Keep meaningful local commits and push only to the existing `codex/ui-design-handoff` branch; `main` remains unchanged. The latest user instruction authorizes public Sites updates at babelshelf.com; preserve local data and public audience.
