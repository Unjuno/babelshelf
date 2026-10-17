# Reviewed natural-language schedule creation

**Goal:** A new scheduled prompt requested in Input uses actual local Bonsai to propose typed conditions/prompt, asks for missing details, and opens the existing editable Schedule review before saving a paused canonical task.

**Architecture:** Add a finite `schedule` planner action. A bounded second generation receives current instruction, device date/time and untrusted bounded dialogue context; only typed recurrence/prompt fields or a clarification question are accepted. Harness supplies timezone, disabled state and default in-app notification. No model output grants activation, path, tools or write authority. Existing exact-target edits stay on schedule.patch. Review uses existing fields and next-occurrence validation. A session-owned UUID gives new-task saves stable identity; creation rejects duplicates without overwriting. Commit acknowledgement and refresh failure are distinct. Proposal attempts use the existing persistent activity layer; pending review never auto-replays on reload.

**Files:** conversation.ts for finite routing; task-proposals.ts for prompt/strict parser/count/Stop; task-records.ts/knowledge-store.ts for paused stable-ID creation; useTasks.ts and Prototype.tsx for acknowledged Save/Cancel/review; harness-activity.ts for proposal audit. Preserve protected runtime, model pins and existing records. No cloud, publication or push.

**Review focus:** ambiguous/missing conditions must not invent a runnable default; source/history instructions cannot change permissions; another save with the same ID cannot duplicate or overwrite; a committed save followed by refresh failure must not be retried as new; sheet dismiss/Repeat/Save/Stop must retain correct ownership; current inputs and summaries are not future execution authority.

- [x] RED/GREEN finite routing, strict typed task/clarification schemas, invalid conditions/permission fields/Unicode/past once, context budget/history and Stop, stable creation/collision and durable activity validation.
- [x] Integrate existing editable review, Paused status, stable identity, cancel/commit outcomes and live task-claim gates without redesigning UI.
- [x] Real IndexedDB create/collision/reopen/restore tests, full checks/builds and independent review.
- [x] Native actual Bonsai new-task generation/clarification or Cancel, review/edit/Save, Memory+Schedule/reload/backup and scoped offline trial. Record builds/limitations and local commit; whole goal remains active.

Result: Unit26 in TEST-RESULTS.txt. Final333b67da1141e9ac executed three fresh offline Bonsai requests: quoted English task/Save; Japanese missing-time clarification (English output mismatch retained); Japanese follow-up/tomorrow/date/prompt/Save. Earlier94 candidate exposed unquoted prompt-boundary over-inclusion and exercised editable draft/Repeat/Cancel. Strict native snapshot48/49 matched81notes/102runs/33originals with all prior records retained. Six separate real-IDB checks passed. Language/prompt/date generalization, latency, physical devices and full-process offline acceptance remain open.

The user explicitly authorized autonomous ordinary implementation and testing; this bounded addition uses the already accepted Task/confirmation design. No additional approval gate is inferred from skill process guidance.
