# Current requirements and next work

Updated 2026-10-18 JST. The whole MVP goal is incomplete. Preserve the latest user instructions and accepted UI; do not restart the historical model comparisons or rebuild already connected features as preview state.

## Read in this order

1. [Accepted product/UI behavior](docs/PRODUCT-SPEC.md).
2. [Current evidence and exact build scopes](docs/MVP-ACCEPTANCE.md).
3. [Remaining gates](docs/REMAINING-GATES.md).
4. [Implementation map](docs/IMPLEMENTATION-PLAN.md), the relevant operation contract, and [original test results](docs/TEST-RESULTS.txt).

Historical unit notes and research reports are observations at their recorded build, not current requirements. Earlier versions of this handoff remain in Git history; detailed failures remain in TEST-RESULTS.txt and research/.

## Connected implementation

The native product entry shares the accepted UI with a canonical IndexedDB adapter. Notes, settings, tasks, executions, notifications, folder/Trash metadata, dialogue and processing receipts persist locally. The Markdown hierarchy is a projection; explicit exports and backups create separate local files.

Natural input connects capture/search/read/answer/summary, retained dialogue/compaction and reviewed corrections. Exact generated-answer Save does not regenerate. Shared source/record checks refuse stale approvals and unapproved overwrites. Source correctness and semantic intent still have known failures; one successful generated answer is not general reliability.

Actual PC evidence exists for Bonsai4B, local Whisper tiny, Tesseract OCR, PDF text/prepared empty-page OCR and video audio transcription. Automatic Send uses only prepared readers. Original bytes, derived results and source locations are distinct. Video frames/general image understanding remain unsupported. Newly processed single-track WebM/MP4 audio has validated container offsets and estimated transcript segments; actual PC installed offline flows are recorded in VIDEO-TIMELINE.md. Legacy transcripts and edited text retain broader source coverage.

Text, Decision and Speech registration/preparation are independent. Bonsai4B remains the default; approved additional local adapters do not silently replace it. Optional Open d1-omni-600M supports connected text decisions only. Catalog entries or custom files do not establish engine compatibility or execution. See [custom model contract](docs/CUSTOM-MODELS-CONTRACT.md).

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

No cloud/LAN inference, personal-data upload, silent acquisition, account/sync service, database reset or unauthorized model overwrite/delete. Preserve IDs, all original revisions/paths, withdrawal state, protected roots and maximum five stored folder levels. Check the actual SW build without deleting existing browser data. Keep meaningful local commits; no GitHub push. The latest user instruction authorizes public Sites updates at babelshelf.com; preserve local data and public audience.
