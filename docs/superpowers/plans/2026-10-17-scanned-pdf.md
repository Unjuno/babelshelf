# Scanned PDF OCR implementation plan

**Goal:** Read image-only PDF pages with the already prepared local OCR adapter, through ordinary Send and explicit review, retaining original-page citations.

**Architecture:** Keep text-layer extraction first. Sequentially render only empty pages at bounded resolution, recognize using the existing pinned Tesseract worker/data, and store per-page OCR provenance in a new PDF extraction schema. Retain schema1 validation and exact stored metadata. No synthetic image originals, network fallback, scene understanding or hidden installation. Existing canonical atomic Send/Save/restore and cancellation apply.

**Spec:** PRODUCT-SPEC.md, PDF-CONTRACT.md, OCR-CONTRACT.md, INPUT-READINGS.md and the active user goal. User authorized autonomous implementation/verification; preserve accepted UI.

- [x] Add RED provenance/backup/citation tests for mixed text/OCR schema2 and old schema1 compatibility, plus sequential page orchestration/Stop/failure/budget tests.
- [x] Implement pure PDF page orchestration and strict per-page OCR pins/regions/size validation. Refactor the existing OCR worker into reusable raster recognition; preserve normal image extraction metadata and lifecycle.
- [x] Connect bounded PDF rasterization and prepared-only OCR to explicit Read text and ordinary Send. Audit OCR policy/results, show truthful text/OCR coverage, keep same raw PDF page previews and source identity.
- [x] Run focused/full tests, builds, protected runtime and independent review. Verify actual image-only/mixed PDF OCR, review/Send/source/restart/backup/restore and Stop in the native PC browser. Distinguish fixtures from actual extraction/model/device evidence.
- [x] Record measured outcomes/limits and commit locally. Do not mark the full goal complete; English planner intermittency, semantic fidelity, remaining media/custom/system-edit/archive/device/full-process offline gates remain.

English recall investigation: Unit22 retry succeeded with changed history. Do not infer a fix. Exact old-context replay remains pending; bounded invalid-output diagnostics are now available for future real failures. No speculative prompt relaxation is included in this PDF unit.

Unit23 evidence: native3a04c93250b384fc/index-BeBjgKoE.js, explicit scan OCR/Save, mixed-PDF automatic OCR + actual D1/Bonsai answer/two page2 OCR refs, stopped12page read and subsequent image OCR passed. Server stopped/new-tab cached boot/tab-network-offline reload/new pixel-only PDF -> actual OCR/D1/Bonsai answer/page1 source passed. Export36/restore/re-export37 exact78notes/94runs/33originals SHA6db43f93c9cf82eb9cf5f49f64253bb2593212213e8f15787dd070137b20f3ed, old72notes/82runs preserved. Both models unloaded, tab network reset, DownloadsOFF and server restored. Baseline40/prototype172/product2/Markdown4/check24/protected28/builds PASS; independent30/source probes no Important findings. Physical devices/full browser-process restart and broader accuracy/remaining goal gates remain open. See TEST-RESULTS.txt for measured latency and scope.
