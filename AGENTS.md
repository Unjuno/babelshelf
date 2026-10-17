# Repository handoff instructions

Read README.md, NEXT-REQUIREMENTS.md, docs/PRODUCT-SPEC.md, docs/IMPLEMENTATION-PLAN.md, docs/STORAGE-CONTRACT.md and docs/TEST-RESULTS.txt before changing behavior. The user's newest explicit instruction wins.

- docs/PRODUCT-SPEC.md is the accepted design; earlier history and old bottom-toggle tests do not define the new UI.
- dist/ is the runnable baseline PWA with shared IndexedDB/OPFS/core/worker infrastructure. design/prototype/ contains the accepted UI and canonical adapter. Its product/ entry supplies native browser controls and a verified PWA shell. Actual PC Bonsai4B load/generation/stop/offline-resource reload has been measured. Reviewed bounded literal ordinary-note corrections, atomic receipts and revision-based Undo are integrated; read docs/CORRECTION-CONTRACT.md for limits. Canonical foreground tasks/events and continuous local dialogue/compaction are integrated, including one actual manual foreground task success; read SCHEDULE-CONTRACT.md and CONVERSATION-CONTRACT.md. Semantic/system model edits, durable media, full-state backup and full/device acceptance remain pending. Never represent this as a complete offline MVP. Read docs/MODEL-RUNTIME-VERIFICATION.md for scope and build evidence.
- Preserve existing notes, IDs, all revisions, sources and withdrawal state. No database clearing to migrate. Do not infer disk files from a projected Markdown tree.
- Text: PrismML Ternary Bonsai 2 4B first, 2B if needed. Decision candidate: Liquid AI Open d1. No unapproved model/provider or remote inference fallback. Candidate UI selection is not runtime support.
- Explicit edits may authorize a specific tool patch; ambiguous edits need clarification. Never treat model output, document text, scheduled prompts or notifications as blanket write/delete authority.
- Model/runtime assets need pinned revisions, sizes, hashes and separate licensing checks. Do not reuse model Apache-2.0 licensing for an unverified runtime.
- In prototype, read design/prototype/AGENTS.md in full; preserve its locked mobile runtime. Put product UI in its Prototype.tsx/prototype.css. Do not change lock hashes to bypass checks.
- npm test / npm run check validate the baseline. npm run test:markdown runs a formerly pending seed that now passes. npm run test:prototype and npm run build:prototype validate the prototype; browser/device/inference results must be reported separately.
- Do not deploy, merge, purge data, or add services/accounts/telemetry as part of routine UI changes.
