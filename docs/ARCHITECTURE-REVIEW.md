# Architecture review and target — 2026-10-26

Scope: current local application after the Send boundary, shared model acquisition and one-button device-test changes. This is a code/design review, not proof of all model/device combinations. Accepted UI, canonical knowledge and history remain invariants.

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
2. Add a versioned pending-review record: target ID, expected version, proposal and originating run. Reopen safely after restart; never automatically approve or repeat inference. Test changed/withdrawn sources, cancellation, backup and legacy records.
3. Add validated active configuration snapshots and last-known-good activation. A settings edit cannot mutate an in-flight run or widen capabilities. Preserve standard/default recovery and source history.
4. Introduce command/query storage ports, then incremental search. Keep the current store as the transaction implementation during migration. Test conflicts, restore, source references and interrupted rebuild; never rebuild by deleting canonical data.
5. Extend runtime residency only for a measured bottleneck. Optional preload and warm reuse must not acquire missing assets silently, interrupt another active role or claim that browser GPU limits imply model fit.

## Performance measurement contract

The default Quick test remains one exact structured READY smoke. Performance is an explicit option under the same Run tests action: one fixed `prose-128-v1` request, up to 128 output tokens. It records actual input/output tokens, configured route, registered quantization metadata when known, model/runtime revision, load state, Load-call duration, generation duration, available TTFT and runtime-memory counters. Unknown custom tensor IDs are retained as IDs, not guessed quantization names.

No user knowledge, chat history, original files or generated reply text are retained in the report or sent externally. The report is local and manually copyable. Original output is discarded. Missing timings are omitted, not filled with invented zeroes; runtime counters are not total process/driver/device memory. Actual output length may be shorter than the cap. One sample cannot establish sustained speed, heat, quality or iPhone/Android compatibility. Home Screen restart checks still require manual OS actions and cannot prove those actions occurred.
