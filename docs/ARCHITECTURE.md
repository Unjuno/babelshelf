# Current application architecture

Updated 2026-10-19. See [architecture rationalization](ARCHITECTURE-RATIONALIZATION.md) for the accepted baseline, evidence-backed findings and active refactor scope. This document describes the runnable product and its real boundaries. `ARCHITECTURE.txt` is retained as a historical 0.1 baseline.

## Runtime and ownership

The product served by `npm run dev:app` is built from `design/prototype/product/` and `design/prototype/src/`. The accepted phone-preview shell is intentionally preserved; the native product entry adapts the same product surface without editing the locked mobile runtime. `dist/` supplies shared storage, worker, request, and PWA-shell code. The local server only serves assets. It does not receive notes, attachments, model prompts, or inference requests.

IndexedDB `mlb-memory-v1` is the canonical knowledge store. The Memory tree projects note paths; it is not a host filesystem. Original attachment bytes, extracted text, dialogue receipts, model assets, and UI projections have separate ownership and backup rules. See `STORAGE-CONTRACT.md`, `MEDIA-HARNESS.md`, `CONVERSATION-CONTRACT.md`, and `BACKUP-CONTRACT.md` for schemas and limits.

## Dependency direction

```text
Product UI (Prototype.tsx, product entry)
  -> application adapters/hooks (useKnowledge, useBonsai, useTasks, useSpeech, useOcr)
  -> domain rules (conversation, knowledge-store, task-records, corrections, citations)
  -> local platform adapters (IndexedDB core, OPFS assets, workers, Service Worker)
```

The current tool registry is a capability boundary: a proposed action selects a finite registered tool, and the tool calls an application-owned adapter. A Markdown skill file describes the tool; it does not install code, grant permission, or execute by itself. Runtime workers are local and role-specific. A model catalog entry does not prove assets are prepared, compatible, or executable.

The intended extension direction is to store versioned, user-editable response presentation, constrained design tokens for one bundled default theme, and supported harness configuration plus several built-in pipeline/profile starting points in Memory. The preferred generation flow is a bounded agent loop over registered typed tools. Models may propose edits to those user-owned records from chat; the app validates and previews them, then requires explicit save, with history and undo. The chat/tool-call protocol, typed adapter schemas, loop budget/cancellation and authorization rules remain fixed application contracts. Built-in defaults stay available; user changes create an override/fork, and Restore defaults resets only configuration through a reviewed atomic operation without clearing knowledge. Memory configuration cannot add executable code, widen permissions, or turn arbitrary Markdown into a tool. Model-generated JavaScript/CSS/HTML is never executed as product UI. Implementation modules remain trusted adapters until a separately reviewed sandbox/package mechanism exists. This configuration layer is a design direction, not current functionality; see `TOOL-PACKAGES.md`.

## Input execution

An input is processed in this order:

1. Pin the user's text, attachment originals, and relevant dialogue revision.
2. Read or derive only content whose local processor is prepared; retain the original and exact source revision/range.
3. Route through a finite literal rule, an explicitly selected local Decision adapter, or the selected Text runtime.
4. Validate the action and target in the harness. Read-only tools return canonical data and receipts; generated answers are checked against exact source pins.
5. Present edits and task changes for review. Commit only with an expected-revision check; preserve the prior version and record the result.

Files, extracted text, history, and model output are data. They never grant tools, write permissions, network permissions, or hidden instructions. Stop invalidates pending work; the harness never silently replays a failed generation.

## Current orchestration seam

`input-submission.ts` now owns one Send submission attempt through explicit snapshot/original/read/commit ports. It prepares and verifies originals, sequences optional extraction, builds the dialogue turn and remembers the acknowledged commit before any UI projection. It cannot select a model or grant tools. Recovery stages pinned durable references only into an empty composer. Stop before commit prevents submission; Stop during commit preserves its receipt and prevents subsequent inference. `Prototype.tsx` adopts that result, renders it and continues the existing routing/review flow. It also owns the attempt ID and AbortSignal used by the coordinator's checks.

`Prototype.tsx` owns the accepted layered UI shell and currently coordinates the Send transaction, media preparation, user review sheets, memory navigation, and task/settings actions. Domain rules are separate modules, but several feature workflows still originate in this component. In particular, a selected working file and a search-discovered file had separate branches for deciding whether a read should open the source or continue to an answer/summary.

`read-intent.ts` is the first shared application seam for that workflow: both branches now produce the same explicit `open` result or a pinned `answer`/`summary` continuation. It creates no model output, storage writes, or new authority. Its unit coverage is in `design/prototype/tests/conversation.test.mjs`.

Future restructuring should extract one transaction boundary at a time from `Prototype.tsx` into application coordinators with explicit dependencies and outputs. Keep domain modules independent of React; keep UI sheets responsible for review and user intent; keep persistence and worker lifecycle behind adapters. Preserve the same canonical records and UI surface while moving code. Do not make a broad file move whose only result is different paths.

## Acceptance boundary

Node tests and controlled worker tests prove contracts, not model quality. Native PC browser flows, installed-PWA cold starts, Sites-hosted delivery, OS-level network isolation, and physical Android/iPhone use are separate evidence. A successful adapter/device probe does not prove real model generation. Current unresolved gates are listed in `REMAINING-GATES.md`.
