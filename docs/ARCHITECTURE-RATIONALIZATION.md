# Architecture rationalization

Decision date: 2026-10-19. Baseline: public build `55b466cb7c95a837`, Site v21. This document records the bounded input-submission refactor requested at that time; it does not certify the broader local-agent product objective or untested capabilities.

## Current status (2026-10-22)

The bounded submission-boundary work below is complete for its original scope. The active objective is broader: a polished local-first PWA agent with offline behavior, adaptable local inference, memory-defined configuration, tools, and safe model-proposed changes. Since this document's original decision, the harness gained versioned `Settings/harness.md` profiles, reviewable profile edits, registered read-only tools, bounded agent-loop calls, custom tool packages, and report-driven iOS diagnostics. See `ARCHITECTURE.md`, `TOOL-PACKAGES.md`, `DEVICE-DIAGNOSTICS.md`, and `REMAINING-GATES.md` for current implementation and limits. The old findings below describe the initial 2026-10-19 state and should not be read as current behavior without this dated update.

## Objective and stopping conditions

Keep the accepted UI, local knowledge, existing model choices, source provenance and reviewed writes. Reduce the number of responsibilities that must change together when a workflow changes. Complete this objective when the ownership map is accurate, the first justified workflow boundary is implemented and integrated, related regressions pass, and the resulting product is checked on the public site. Further refactors require a concrete benefit; file counts and test counts are not success metrics. Physical-device testing and repeated model comparisons are not prerequisites for this scope.

## Observed implementation

| Responsibility | Current code | Ownership and boundary |
|---|---|---|
| UI and interaction | `design/prototype/src/Prototype.tsx`, `product/` | Composer, review sheets, navigation and transient display state |
| Input submission | `input-submission.ts` | One attempt owns copied inputs, original verification, extraction sequencing, prior/expected dialogue snapshot, commit acknowledgement and recovery references |
| Input orchestration | `Prototype.tsx` `send()` | Supplies adapters, adopts committed state, prepares context, routes actions, calls tools and presents review/results |
| Context and intent | `conversation.ts`, `read-intent.ts`, current-input/working-file rules | Original turns and versioned source targets; compaction is a derived context representation |
| Text execution | `text-inference.ts`, `text-engine-router.ts` | Pinned runtime identity, token budget, cancellation and trusted backend selection |
| Canonical knowledge | `useKnowledge` and knowledge-store adapters | IndexedDB records/revisions; Memory is their path projection, not an OS filesystem |
| Media | Speech/OCR/PDF/Vision adapters and workers | Originals and derived readings remain distinct; no inference from filename alone |
| Tools and writes | Registered tool adapters, correction/task/settings contracts | Model proposals do not grant permission; revision checks, review and receipts remain authoritative |

Evidence comes from reading the implementations, not from assuming the diagram is already enforced. In particular, the UI currently calls domain and persistence operations directly as part of the Send workflow. The desired dependency direction in ARCHITECTURE.md is only partially separated at this boundary.

## Findings and decisions

1. **The principal coupling is workflow ownership.** `send()` coordinates asynchronous extraction, atomic submission, planning, context compaction, model loading, tool dispatch, review UI and error recovery. Moving that whole function into another file with the same captured component state would not resolve the coupling. First separate the submitted-input lifecycle from presentation: explicit input snapshot, operation identity, cancellation checks, committed submission result and terminal result. Retain existing revision checks and persistence adapters.
2. **Model abstraction already exists.** `TextRuntime` and `TextEngineRouter` separate local execution and trusted backend selection. Preserve them. Adding another generic engine framework is not justified by current evidence. Extraction roles have different outputs/provenance and should not be forced through a text-generation-only interface.
3. **Memory configuration must not own execution authority.** At the decision date, a configurable harness/presentation layer had not been implemented merely by describing it in Memory. The current implementation now stores versioned harness profiles in `Settings/harness.md`; the app validates registered tool IDs and lower-only budgets, while tool execution, cancellation, source validation and approval remain application-owned. Configuration still cannot add write/delete/network/MCP authority.
4. **A failure record must distinguish stages.** Original input may have been committed even if planning or generation fails. The extracted coordinator must expose this distinction so the UI can recover a draft without falsely claiming that nothing was saved or duplicating originals on retry.
5. **Evidence is scoped.** The public build manifest currently matches the accepted build. The corrected API probe reports `navigator.gpu` present; neither that result nor a catalog entry proves a model can load or generate. Do not make architecture decisions from the invalid Unit42 probe.

## First implementation boundary

Audit and extract the Send submission lifecycle with explicit dependencies for storage, context/runtime and reporting, keeping review presentation in React. Start with the smallest lifecycle that reduces state capture; do not rewrite planning, tool policy, workers and storage simultaneously.

Required checks for that change:

- Before submission failure retains the unsent draft and does not report a committed input.
- After submission failure retains committed originals/dialogue and reports the failed stage.
- Stop or a stale operation cannot publish a later result or silently retry.
- A new draft typed during an older operation is not overwritten by recovery.
- Reviewed edits and generated-answer Save keep their existing exact-content/revision contracts.

Use existing controlled tests to cover lifecycle races, then exercise the changed normal/error flow on the actual product. Real inference is needed only if the inference boundary changes or the affected flow cannot otherwise be checked. No new storage schema, automatic data migration, backend service, generalized plugin loader or global event bus is part of this decision.

## Progress

- Goal created; current implementation and accepted release inspected.
- Acceptance wording updated without discarding historical verification limits.
- Incorrect WebGPU observation corrected in the evidence ledger.
- `input-submission.ts` now implements the submission boundary and is called by the actual product Send flow. Its ports are snapshot, original read, extraction and commit; it has no React dependency, model selection, download permission or UI writes.
- Commit acknowledgement is retained before UI projection/refresh. Stop during an atomic commit cannot pretend it was rolled back. Recovery only stages durable original references into an empty composer. Each attempt runs once; operation ID and AbortSignal checks reject stale continuation.
- The UI supplies existing persistence adapters, adopts the committed dialogue and renders it; planning, review sheets, compaction and inference remain in their existing locations. This is deliberate bounded restructuring, not a claim that all orchestration has moved out of the component.
- Published Site v22/build `09913024bec5dcaa`, canonical code commit `8d2cb7b`. Details and evidence: TEST-RESULTS Unit44 and SITES-DEPLOYMENT.md.

## Completion audit

| Requirement | Evidence |
|---|---|
| Preserve accepted product UI/local data | No JSX/CSS/schema changes; public calculation, reviewed Save, attachment preview and reload succeed; all 17 pre-existing canonical notes compare equal |
| Factual responsibilities and ownership | Table above and actual `createInputSubmission` call in `Prototype.tsx`; the input-submission boundary is distinct from the later implemented versioned harness described in `ARCHITECTURE.md` |
| Reduce a concrete coupling | Preparation/commit/recovery no longer capture component state; UI receives a committed result through typed ports rather than constructing storage payloads itself |
| Failure before/after commit, Stop, stale operation | Seven lifecycle tests include failed commit, Stop during extraction/commit, stale snapshot, recovery and pinned-reference validation; current public unprepared-model failure/retry preserves one original |
| No new draft overwrite | Recovery test refuses both a nonempty replacement draft and newly added attachments; existing conditional composer clearing retained |
| Preserve exact Save/review/history contracts | Existing prototype suite464 passes; public reviewed calculator-result Save retains exact `391`; no generation was used for that check |
| Relevant regressions and current public delivery | Baseline100, prototype464, product2, TypeScript/runtime lock/check/build pass; public served JS and manifest match build09913024bec5dcaa |

The specific 2026-10-19 bounded input-submission refactor is complete. It does not complete the broader active architecture objective. Physical devices, model semantic quality, and existing unsupported adapters retain their prior evidence limits; they are not certified by this refactor. No broad restructuring or additional model comparison is required to close that historical bounded scope.
