# Conversation turn application boundary

Date: 2026-10-21 | Status: Draft for user review; implementation has not started.
Scope: Extract the post-submission conversation workflow from the React prototype into an explicit application boundary.

## Problem

`input-submission.ts` already owns the pre-inference Send transaction: it snapshots the composer, verifies originals, performs prepared extraction, commits dialogue/originals/readings, and returns an acknowledged result. After that commit, `Prototype.tsx` still coordinates route selection, history compaction, engine preparation, optional Decision routing, read-only tool calls, file/input scoping, grounded answers, correction and schedule proposals, source references, progress, and failure recovery. This makes a model or harness change depend on a large component closure and makes it difficult to test the workflow independently of React.

The next boundary must reduce that coupling without changing the accepted product behavior or confusing a committed input with a failed later inference.

## Goals

- Move the post-submission turn workflow behind a React-independent application coordinator.
- Pass each operation an immutable snapshot of the submitted text, attachment/source pins, dialogue revision, opened-file pin, and selected role/runtime identities.
- Expose persistence, inference, decision, media-reading, and tool operations only through explicit typed ports supplied by the product composition layer.
- Return explicit typed outcomes for final answers, search/read results, local calculations, reviewed correction/schedule proposals, capture/save review, unsupported/unprepared inputs, cancellation, and failure stage.
- Keep local inference, provenance validation, reviewed writes, operation cancellation, and per-turn bounded tool access enforced by existing trusted application/domain code.
- Make a future model/runtime substitution implement the same per-turn application contract without changing canonical knowledge storage or the phone UI.

## Non-goals

- No visual redesign or change to the public UI in this refactor.
- No storage schema, backup format, model default, catalog admission, runtime binary, prompt semantics, or tool permission change.
- No generic plug-in executor, arbitrary user code, network tool, global event bus, or new agent framework.
- No migration or rewrite of `input-submission.ts`, canonical IndexedDB records, worker protocols, source pins, or review/approval screens.
- No claim of 8B/9B performance, iPhone compatibility, fully offline cold start, or semantic model quality from unit tests.
- No deployment as part of this design/refactor unless separately requested.

## Proposed ownership

```text
React product composition (Prototype.tsx)
  - captures current UI state once
  - runs input-submission transaction
  - creates per-turn ports and forwards progress
  - renders returned outcome and requests user review

Conversation-turn application coordinator (new pure TypeScript module)
  - accepts acknowledged submission + immutable turn snapshot
  - runs route precedence, context budgeting, bounded tools and action workflow
  - checks cancellation/current operation at asynchronous boundaries
  - returns a typed outcome; never renders, persists React state, or grants authority

Existing domain/application modules
  - conversation, turn-router, input scope, citation/evidence, correction/task proposals
  - KnowledgeStore and tool validation contracts

Trusted local adapters
  - TextEngineRouter and role-specific inference workers
  - local media readers and canonical storage adapters
```

The coordinator reuses existing pure modules (`turn-router.ts`, conversation/context helpers, scope binders, `agent-loop.ts`, validators, and tool registry contracts). It does not duplicate model routing or create a second model abstraction. Product-specific closures remain at the composition boundary as port implementations, but the coordinator itself receives only the values and capabilities for the current turn; it must not capture mutable React state.

## Per-turn input and ports

The immutable input is created after `input-submission.ts` acknowledges commit. It contains the operation ID, exact submitted text, committed dialogue snapshot/revision, submitted attachment/source references and extraction status, the prior opened-file ID/revision if any, and selected model identifiers. It contains no inferred authority. Large media bytes are accessed through a narrow local-original port using pinned references rather than copied into a second application snapshot.

Ports are explicit and scoped to one invocation:

- `check()` or an `AbortSignal`-backed guard that rejects stopped, superseded, or stale operations.
- Runtime operations for the already selected Text/Decision roles; they cannot select/download another model or silently fall back to remote inference.
- Read-only canonical search/read/view and registered calculator operations with per-turn allowed tool IDs and the existing step/result budgets.
- Grounding and read operations that validate exact note ID/revision/ranges and original media pins.
- An expected-revision dialogue checkpoint for persisting derived compaction metadata; this cannot rewrite or discard original turns.
- Activity reporting that preserves current local receipts and diagnostic-log policy without making diagnostics affect the result.
- Context count/compaction and the existing target-binding functions, using the exact selected model's context budget.

Knowledge/task mutation remains represented as a proposal. The coordinator can return correction or schedule proposals for the existing review UI; only the existing explicit user confirmation and expected-revision transaction can commit them. Dialogue compaction is derived auxiliary metadata and may be checkpointed through its expected-revision port. A generated answer's Save path retains exact reviewed bytes and source pins; it never re-runs inference.

## Outcome contract

Use a discriminated result rather than callbacks that mutate screen state. Expected variants include `answer`, `calculation`, `search`, `open-source`, `review-correction`, `review-schedule`, `review-capture`, `input-saved-unreadable`, `unprepared`, and `cancelled`. Each variant carries only the payload required by its existing UI continuation: exact result text, references, selected file pin, or a validated proposal. Errors retain a stage such as `routing`, `context`, `tool`, `inference`, or `grounding`; an error after submission cannot imply that the input transaction rolled back.

Progress/activity events are separate from terminal outcomes and use stable operation IDs. A UI event from an obsolete operation is ignored. The coordinator does not directly call `setState`, `toast`, `openNote`, `setSheet`, or mutate composer contents.

## Data and control flow

1. React captures text/attachment handles and creates the operation ID/abort controller.
2. `createInputSubmission(...).run(...)` verifies originals/readings and atomically commits the input. The returned acknowledgement is retained before any UI refresh.
3. React creates an immutable `SubmittedTurn` from the acknowledged dialogue and pinned refs, plus invocation-scoped ports.
4. The coordinator checks the operation, applies deterministic literal/input/saved-source precedence, and uses the existing Decision/Text route order where applicable.
5. When needed, it loads only the selected prepared local runtime, computes a bounded context, and runs only registered tools approved for that exact turn. User files, model output, history, and tool results remain untrusted data.
6. It binds exact current-file/input/history targets, validates source ranges and generated evidence, and returns an answer/result/proposal outcome.
7. React renders the terminal outcome or opens the existing review UI. Reviewed mutations use existing compare-and-swap storage transactions.

## Failure, cancellation, and recovery

- Before submission commit, existing `input-submission.ts` recovery retains the unsent draft.
- After commit, routing/inference/tool/grounding failure retains the committed user turn and original attachments. Recovery may stage the original into an empty composer only under its existing no-overwrite rule; retry is a new explicit Send, never an automatic replay.
- Stop/supersession is checked after each awaited port and before each visible outcome. A stale operation cannot publish progress, result, or recovery into a newer draft.
- A failure in diagnostic logging must not alter the primary result.
- Worker failure preserves the original engine error and uses existing explicit fresh-Load behavior. This coordinator does not retry, switch model, change backend, or re-download.
- Proposal validation failure returns an error/outcome; no partial canonical write occurs.

## Compatibility invariants

- IndexedDB `mlb-memory-v1`, original assets, revision history, dialogue IDs, explicit links, citations and backup contracts remain byte/schema compatible.
- No model-originated write/delete or permission escalation; all correction and schedule changes remain review-gated and revision-checked.
- The tool allowlist stays finite, local-only, read-only for agent-loop tools, with current call/result bounds and cancellation.
- All routine inference and file processing remain on-device; downloads require existing explicit settings permission and preparation flow.
- Current text/decision/media selection and capability readiness remain distinct. Model labels do not create execution capability.
- Existing visual shell, native product entry, and PWA build structure remain unchanged.

## Verification and acceptance

The implementation plan must add focused tests before extraction and retain the full existing suites:

- Route precedence and exact selected input/file/history scope produce the same typed outcomes as the current flow.
- Literal calculation, read/search/answer/summary, Decision fallback, bounded read-only tool loop, correction proposal, schedule proposal, capture review and unreadable attachment have deterministic mocked-port coverage.
- A pre-commit failure, post-commit failure, Stop during each awaited stage, stale operation, and a newly edited composer prove no duplicate submission, no stale publication, and no draft overwrite.
- Source citations still resolve to the committed original/revision/range; stale or forged evidence remains rejected.
- Review actions still write only after user confirmation and expected-revision validation; Save preserves the exact reviewed answer body.
- The coordinator imports no React/DOM/UI module and does not access browser global storage directly; product composition supplies adapters.
- Run core/prototype tests, `npm run check`, and `npm run build:app`. Exercise normal Send, stop, post-commit failure/retry, file citation, and reviewed correction/save in the local PWA. Keep browser/device and model-generation evidence explicitly separate.

## Rollout boundary

Extract one workflow at a time behind the new coordinator, first preserving outcomes and receipts for the current normal routes. Do not simultaneously change model formats, engine implementations, prompt wording, catalog defaults, or UI. Keep a compatibility wrapper only during the extraction; remove it in the same implementation series once parity tests cover all call sites. If the scope requires a new persistent schema or altered permissions, stop and create a separate design decision rather than expanding this refactor silently.
