# Architecture review and target — 2026-10-28

Scope: current local application after the Send boundary, shared model acquisition and one-button device-test changes. This is a code/design review, not proof of all model/device combinations. Accepted UI, canonical knowledge and history remain invariants.

## Current source inspection · 2026-10-28

`design/prototype/src/Prototype.tsx` is 271,618 bytes across 1,148 lines. Its final render line is 56,647 characters and contains 50 conditional sheet branches spanning 41 sheet identifiers (model/profile setup, media reading, task execution, Memory/file actions, source previews and others). Several focused presenters already exist, but the remaining sheet tree still concentrates presentation and callbacks in the root component. This is a verified ownership/readability concern, not evidence of a runtime defect or justification for a large prop bag.

Next refactor: review the classified active diff for duplicate ownership and stale paths, then group one complete sheet workflow behind a typed, domain-specific view model while leaving validation, persistence, revision checks and model/tool authority in their current application/domain owners. Avoid a single omnibus modal component and avoid moving code solely to lower the line count. Verify the same user-visible flow, keyboard dismissal, cancellation and approval behavior before extending the seam.

## Active worktree map · 2026-10-28

The current local diff spans several independent product areas. Keep these changes reviewed and tested as coherent groups; do not stage generated `dist/` output separately from its source build changes.

| Change group | Current owners | Boundary to preserve |
| --- | --- | --- |
| Answer, intent and source integrity | `turn-router.ts`, `grounded-answer.ts`, `conversation.ts`, `submission-workflow.ts`, `dialogue-writer.ts`, `grounding-conflict.ts`, `execution-source.ts`, `sourced-calculation.ts` | Model proposals remain candidates; source/version checks, calculator execution and commits remain application-owned and review-gated. |
| Reading and attachments | `automatic-reading.ts`, `input-readings.ts`, `vision-worker.ts`, `vision-output.ts`, `PdfPreview.tsx`, `backup-state.ts` | Original assets and derived readings retain separate lineage; the answer route receives only explicitly selected, validated evidence. |
| Tasks and schedules | `scheduled-answer.ts`, `scheduled-calculation.ts`, `task-records.ts`, `task-status.ts`, `useTasks.ts` | Schedules are paused until enabled; execution receipts are validated against their stored prompt and answer. |
| Memory and recovery | `knowledge-store.ts`, `note-corrections.ts`, `note-provenance.ts`, `memory-trash.ts`, `backup-state.ts`, `StartupRecovery.tsx` | IndexedDB remains canonical; revisions, compare-and-swap checks and conflict refusal stay inside storage operations. |
| Models, tools and diagnostics | `app-settings.json`, `model-diagnostics.ts`, `model-file-guidance.ts`, `device-diagnostics.ts`, `agent-loop.ts` | User configuration selects bounded registered capabilities; it does not grant arbitrary network, filesystem or write authority. |
| App lifecycle and delivery | `offline-shell.ts`, `startup-recovery.ts`, `scripts/build-product.mjs`, `scripts/product-worker.mjs`, `scripts/qa/*`, `dist/*` | Build outputs must correspond to source and manifest; cache updates must preserve offline assets and local user data. |
| Screen integration | `Prototype.tsx`, `SettingsHomeScreen.tsx`, `HelpPage.tsx`, `PdfPreview.tsx`, `prototype.css` | The root composes workflows; domain validation and persistence should not migrate into presentation components during extraction. |

The main cross-group seams to review first are `Prototype.tsx` (routing, modal state and presentation are still coupled), `input-readings.ts` (shared by answer preparation and stored reading validation), and `knowledge-store.ts` (canonical read/write and grounded dialogue commit share transaction authority). These are not all refactor targets: preserve the shared invariants, and split only where an application-facing operation can own a complete user workflow without duplicating the transaction rules.

## Assessment

The application is a local modular monolith with useful boundaries, not yet a fully separated execution platform. Preserve it and move responsibilities incrementally. A configurable general workflow engine or a framework rewrite would add migration and compatibility costs without resolving the current concrete gaps.

| Area | Current evidence | Target / priority |
| --- | --- | --- |
| Send | `submission-controller` owns attempt/Stop, `submission-workflow` owns dispatch and typed outcomes | Keep. Add durable review identities independently; do not replay generation after a reload. |
| Runtime | `model-execution` shares Text/Decision acquisition and reader release; engine clients retain leases and Worker cleanup | Keep existing lease authority. Extend capability adapters and residency policy as measured needs arise, rather than retaining all models at once. |
| Results | Host-owned answers, partial/blocked results and review handoff are distinct from lifecycle completion | Keep. User-approved commits should eventually acknowledge their review identity, with CAS and stale-review refusal. |
| Knowledge | IndexedDB canonical; Markdown hierarchy is a projection; originals/extractions/revisions/source pins are retained | Preserve atomic transactions. Expose explicit create/correct/move/withdraw/recover commands rather than broad UI-list diffs. |
| Search | `KnowledgeStore.search` reads all records before querying | Scaling risk, not a measured latency claim. Introduce a disposable incremental index with generation/version invalidation, bounded reads and rebuild. |
| Settings | Versioned Memory records, validators, fallback and reviewed proposals exist | Pin a validated configuration snapshot per run, including note revision, model/runtime identity and tool-package identity. Separate edit/save from activation and last-known-good recovery. |
| Tools | Registered host capabilities and bounded custom QuickJS execution | Preserve limits, input validation, receipts and no automatic network/write grant. A skill file cannot grant authority; arbitrary MCP transport is not implemented. |
| Schedule | `scheduled-answer` is read-only and shares acquisition/grounding | Preserve narrower authority. Foreground/resume execution remains honest; no guarantee of closed offline PWA timers. |
| Diagnostics | One-button suite, one-shot restart claim, isolated checks and bounded private reports | Add reproducible optional workload measurements. Do not turn a smoke or one sample into quality/thermal/general-device acceptance. |
| Delivery | Canonical GitHub source builds one verified app; a separate Site adapter stages it | Keep the adapter thin, verify exact manifest/transport, retain the previous public hashed assets, and verify the active SW/page build without clearing user storage. |

## Dependency direction

UI -> application operations -> domain contracts -> local adapters.

Application operations choose scope and sequence. The harness plans only within that scope. Runtime policy selects an already registered/prepared engine and owns acquisition decisions; low-level clients retain Worker and lease ownership. Knowledge operations validate source eligibility, approval and expected versions. The UI presents data/reviews and supplies user actions. Memory definitions may configure behavior but cannot replace authorization, storage integrity, protocol validation or cancellation limits.

A run should pin: request/scope, configuration revision, selected model/runtime revision, tool identities, source revisions, Stop ownership and its typed outcome. Related canonical changes must still be one transaction; splitting repositories must not split an atomic commit.

## Migration order and gates

1. Completed foundations: isolate Send, outcomes, Text/Decision acquisition and scheduled answering. Preserve local transactions and existing interface.
2. Correction-review persistence is implemented for existing note/settings/schedule/tool-source proposals: one versioned local record, exact target/dependency snapshots, explicit resume, atomic approval/receipt/deletion and CAS cancellation. See PENDING-REVIEWS.md. Extend durable recovery separately to capture/new-task reviews; neither startup nor restore may automatically approve or repeat inference.
3. Add validated active configuration snapshots and last-known-good activation. A settings edit cannot mutate an in-flight run or widen capabilities. Preserve standard/default recovery and source history.
4. Introduce command/query storage ports, then incremental search. Keep the current store as the transaction implementation during migration. Test conflicts, restore, source references and interrupted rebuild; never rebuild by deleting canonical data.
5. Extend runtime residency only for a measured bottleneck. Optional preload and warm reuse must not acquire missing assets silently, interrupt another active role or claim that browser GPU limits imply model fit.

## Performance measurement contract

The default Quick test remains one exact structured READY smoke. Performance is an explicit option under the same Run tests action: one fixed `prose-128-v1` request, up to 128 output tokens. It records actual input/output tokens, configured route, registered quantization metadata when known, model/runtime revision, load state, Load-call duration, generation duration, available TTFT and runtime-memory counters. Unknown custom tensor IDs are retained as IDs, not guessed quantization names.

No user knowledge, chat history, original files or generated reply text are retained in the report or sent externally. The report is local and manually copyable. Original output is discarded. Missing timings are omitted, not filled with invented zeroes; runtime counters are not total process/driver/device memory. Actual output length may be shorter than the cap. One sample cannot establish sustained speed, heat, quality or iPhone/Android compatibility. Home Screen restart checks still require manual OS actions and cannot prove those actions occurred.
