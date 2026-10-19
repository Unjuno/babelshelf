# Architecture rationalization

Decision date: 2026-10-19. Baseline: public build `55b466cb7c95a837`, Site v21. The user accepts this product as completed and requests rational design and architecture. This document starts a new work scope; it does not retroactively certify untested capabilities.

## Objective and stopping conditions

Keep the accepted UI, local knowledge, existing model choices, source provenance and reviewed writes. Reduce the number of responsibilities that must change together when a workflow changes. Complete this objective when the ownership map is accurate, the first justified workflow boundary is implemented and integrated, related regressions pass, and the resulting product is checked on the public site. Further refactors require a concrete benefit; file counts and test counts are not success metrics. Physical-device testing and repeated model comparisons are not prerequisites for this scope.

## Observed implementation

| Responsibility | Current code | Ownership and boundary |
|---|---|---|
| UI and interaction | `design/prototype/src/Prototype.tsx`, `product/` | Composer, review sheets, navigation and transient display state |
| Input orchestration | `Prototype.tsx` `send()` | Copies input, records originals, prepares context, routes actions, calls tools, presents reviews, records results and recovers drafts |
| Context and intent | `conversation.ts`, `read-intent.ts`, current-input/working-file rules | Original turns and versioned source targets; compaction is a derived context representation |
| Text execution | `text-inference.ts`, `text-engine-router.ts` | Pinned runtime identity, token budget, cancellation and trusted backend selection |
| Canonical knowledge | `useKnowledge` and knowledge-store adapters | IndexedDB records/revisions; Memory is their path projection, not an OS filesystem |
| Media | Speech/OCR/PDF/Vision adapters and workers | Originals and derived readings remain distinct; no inference from filename alone |
| Tools and writes | Registered tool adapters, correction/task/settings contracts | Model proposals do not grant permission; revision checks, review and receipts remain authoritative |

Evidence comes from reading the implementations, not from assuming the diagram is already enforced. In particular, the UI currently calls domain and persistence operations directly as part of the Send workflow. The desired dependency direction in ARCHITECTURE.md is only partially separated at this boundary.

## Findings and decisions

1. **The principal coupling is workflow ownership.** `send()` coordinates asynchronous extraction, atomic submission, planning, context compaction, model loading, tool dispatch, review UI and error recovery. Moving that whole function into another file with the same captured component state would not resolve the coupling. First separate the submitted-input lifecycle from presentation: explicit input snapshot, operation identity, cancellation checks, committed submission result and terminal result. Retain existing revision checks and persistence adapters.
2. **Model abstraction already exists.** `TextRuntime` and `TextEngineRouter` separate local execution and trusted backend selection. Preserve them. Adding another generic engine framework is not justified by current evidence. Extraction roles have different outputs/provenance and should not be forced through a text-generation-only interface.
3. **Memory configuration must not own execution authority.** Existing managed records are appropriate for versioned settings. The planned configurable harness/presentation layer is not implemented merely because its description is in Memory. Typed validation, registered code, cancellation and approval remain application-owned. Add configuration only for an actual supported behavior.
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
- Lifecycle extraction and its integration verification remain pending. This document is a design decision, not a claim that the refactor has shipped.
