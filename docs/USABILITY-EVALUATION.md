# Task-based usability evaluation

## 2026-10-27 — Stop, recover input, and generate again

Actual unchanged23ae43723e1c44af Windows sidebar, selected prepared Bonsai2 4B: sent a synthetic original-story request of at least1500 words, waited through local model verification/warmup to Generating, then pressed Stop. The first post-click AX observation showed Stopped, the exact story request restored to Message, and attachment/voice/Send enabled. The host interaction plus observation took446ms; this is not an instrumented cancellation latency measurement or proof of immediate GPU-kernel shutdown. The stopped turn had no completed answer or Save note action.

Replaced only that test-owned recovered text with Hello. The same selected model returned the actual response “Hello! How can I help you today?” without page reload, model reselection, or an explicit new preparation. No stale story output replaced the new reply. The pre-existing user draft was restored afterward and not submitted. No original note or setting was edited. App connection mode stayed Online; do not infer OS/network isolation. Screenshot: outputs/stop-and-resume.png (Stop and a separate new generation, not continuation of the stopped story).

No defect was reproduced in this flow, so the working controller/runtime path was retained. Current focused controller/workflow/text-inference/worker regressions39 passed. This narrows the PC interruption evidence gap only; repeated stress, memory/thermal behavior, exact prefill/decode cancellation points, partial-response continuation, and physical iOS/Android remain unverified. Public release remainsv182; this follow-up changes documentation only.

## 2026-10-27 — source-dependent follow-ups and invalid history recovery

Actual local sidebar on100d2301fc13e22d: after a sourced answer about the meeting place, 「その集合の持ち物は何？」 selected chat and answered that the belongings were the filenames QA-creation-draft and QA-旅程, with no source. Planner1638 input/15 output took37573ms. Model-facing history retained found titles but dropped all answer source identities; the planner could not distinguish a sourced answer from unsupported dialogue. Evidence: outputs/followup-before.png. The erroneous historical answer was retained, not rewritten.

The history projection now retains bounded source ID/revision metadata, separately from verified evidence, and labels file names/IDs as navigation metadata. Quotes/paths/arbitrary reference fields are excluded; originals and stored dialogue are unchanged. A first provenance-only candidate96b6a6dcf9d14fef refused a model-selected recall/history plan missing its original selectors. This did not establish a successful follow-up and was not published as a completed fix.

Final23ae43723e1c44af adds one per-turn replan only for the fixed history-target validator rejection. No raw rejected output is used as instructions and no index/speaker is guessed. Validation, context limits, Stop, receipt persistence and tool budgets remain authoritative. An invalid repeated plan, other protocol errors or runtime failure do not loop. Controlled coordinator tests verify failed/success receipts, exact human request, no tool execution from the invalid plan, bounded attempts and no retry after Stop or failed receipt save.

Actual prepared Bonsai2 4B on final build: the same request first hit the invalid history selector, then selected answer/knowledge on its one retry. Retry1825 input/19 output took42844ms. Final answer 「青いノート。」 had a citation opening Inbox/QA-旅程.md v2 with the exact original 「集合は午前10時。持ち物は青いノート。」. No knowledge edit, model download or fake inference; outputs/followup-source.png. This verifies this source-backed fact, not general event disambiguation or multilingual quality. The records' wider relationship was not independently established; latency and ambiguous cross-record subjects remain open.

Final prototype905, coordinator15, combined conversation/native/coordinator146, product6, check/build/strict TypeScript and protected runtime28 passed. Physical phones, broad follow-up quality and the full quality chain were not rerun.

## 2026-10-27 — finish a search-and-answer request

Actual local sidebar on78571b1e36c3e0d6: 「集合場所について保存したメモを探して、今の集合場所を教えて。」 selected search/集合場所 and found two records, but stopped at the list instead of answering. Planner1676 input/10 output tokens took80197ms; no general speed claim. A shared final-outcome prompt experiment on69a3c526eced5053 still stopped at the list and was removed rather than shipped as a fix.

Fix on100d2301fc13e22d: model-selected searches with text passages use the existing bounded completion-decision pattern shared with read. The classifier receives only the exact human request, may select list/answer/summary, and cannot write or grant tool permissions. Answer/summary proceeds through existing canonical source validation. Explicit search commands remain model-free; empty or file-metadata-only results remain navigation. Invalid or stopped classification fails without inventing an answer. Decision-origin searches acquire the selected prepared Text route through the shared manager, without network acquisition.

Actual local prepared Bonsai2 4B on the final build selected search, then search-completion=answer, and returned the exact original text 「集合場所は北口。まだ作成途中です。」 with a citation. Source opened Inbox/QA-creation-draft.md v3, the current post-Undo revision; old v2南口 was not used. Save note opened the exact assistant-message copy review; explicit Save created Inbox/QA-recall-completion.md v1 with matching bytes and Original message provenance. No model download, original overwrite or fake inference. Existing retained dialogue also exercised compaction. This is one Windows sidebar flow, not broad multilingual quality or physical-device acceptance. Extra completion inference and slow prefill remain latency costs.

Regression: production-scope application tests cover planned search -> answer/citation without writes, explicit literal/natural searches without a model, list/summary choice, invalid/Stop refusal and metadata-only results. Full prototype903 passed before the final additional explicit-search test; final submission25 passed. Product6, check, build/strict TypeScript and protected-runtime28 passed. Delivery135 assets verified. Screenshot: task outputs/recall-current-source.png.

## 2026-10-27 — resuming an unapproved correction

Observed on e9b520a1d40fb091: choosing another Assistant profile opened the real Before/After review, but ordinary reload removed the unapproved proposal and offered no way to resume it. The active profile correctly stayed Standard; loss of the proposal was the defect. Three built UI tests reproduced missing recovery on the old artifact.

Fix: one validated local pending-correction record; Input > Review changes resumes it without inference or approval. Dismissal retains it, explicit Cancel compares and removes only its own record, and Save commits the revision/receipt/record deletion atomically. Changed targets and replaced proposals refuse approval. An old screen cannot cancel a different proposal created by another tab. Staging is abortable; already committed proposals remain inert/manual after Stop. See PENDING-REVIEWS.md for the storage/backup contract and limits.

Actual local sidebar, intermediate06bfae0ca4b35c48: selected prepared Bonsai2 4B received In this file, replace 北口 with 南口 for the synthetic QA-creation-draft.md. Actual model proposed the correct exact replacement. Escape/reload showed Review changes and the working file stillv1. Resume showed identical Before/After; explicit Save createdv2. History retained originalv1 and one correction receipt; Undo appendedv3 with original text. Models subsequently showed Files present/Load (unloaded); default selections were not changed. No model download or fake inference was used. Original Input draft remains held for restoration after update verification.

Final78571b1e36c3e0d6 has fresh Chromium editor/review12-case verification and four WebKit recovery/concurrency cases, plus isolated production IndexedDB cancellation/transaction tests. Prior5f7b1f36e03a8030 passed the full12 on both browsers; an earlier06bfae0ca4b35c48 WebKit run had two existing-editor failures, retained as an unresolved repeatability observation. Do not claim a device guarantee from later focused passes. Physical iOS, OS force-close and capture/new-task pending review recovery remain open.

Publicv180 sidebar adopted matching page/worker and returned Offline. A profile proposal survived Escape/reload/resume with originalv1; Cancel removed only the proposal. Reload confirmed Standard/Balanced/empty guidance and no Review changes button. This did not approve or alter the user's profile. Local final page adoption retained the actual correction/Undo history, restored the held Input draft and confirmed no pending review remained.

## 2026-10-26 — creation forms and schedule conditions

Observed in the sidebar on6178c8ec9ee2f989: a new note's name/body disappeared after Escape and reopening. A new schedule prompt disappeared the same way. Both forms closed or reset their fields without testing whether the user changed them.

Fix on e9b520a1d40fb091: share the existing unsaved-work review with creation and schedule cancellation. The confirmation has separate state from the underlying form, preserving body/path and pinned answer-copy/task provenance while the confirmation is visible. Snapshot a form only when it opens; returning from Schedule Repeat does not rebase an edited task. Keep editing and dismissal of the confirmation retain the draft. Explicit discard performs the pending action once; successful Save closes without asking to discard. Switching File/Folder also checks the outgoing dirty form. Untouched forms close directly. Browser beforeunload protection covers these dirty forms where supported; it is not durable OS-termination recovery.

Actual local sidebar: created a Japanese note, used Escape/Keep editing and saved the exact body asv1. Entered a schedule prompt, selected Every day, cancelled/kept editing and observed both prompt and condition preserved; explicit discard left No schedules. No model loading or inference was needed. The pre-existing Input draft is retained without submission.

Built-app regression: original editor4 plus new-file dismissal/kind switching, empty form/folder discard, schedule Repeat/cancellation/Save, and answer-copy provenance,8 cases each on Windows Chromium and WebKit. The answer-copy test uses the real deterministic calculator tool and checks the saved answer and original-copy preview; it does not simulate model inference. Initial creation and schedule tests failed on the previous artifact before the fix. Root169/prototype897/product6, strict TS/build, static/pins and protected runtime28 passed.

Public v179 sidebar: matching page/active worker verified; restored Offline. New Japanese/English file survived Escape/Keep editing/Save and ordinary reload/search/reopen. Weekly schedule retained prompt/conditions through Keep editing; explicit discard left No schedules. No model preparation or inference was needed. Details: SITES-DEPLOYMENT.md.

Remaining: durable pending reviews and drafts across OS termination, creation/package/model-registration drafts outside this tested scope, and broad intent/model-quality acceptance. A pass in these bounded PC tasks does not finish the full application goal.

## 2026-10-26 — direct editing and navigation

Scope: existing Windows Codex sidebar profile, local product build6178c8ec9ee2f989; accepted UI and canonical IndexedDB data retained. Synthetic Japanese note only; no inference, model acquisition or user-document export needed for this task.

Task: create a note, correct its meeting time, navigate through its breadcrumb, then find the saved note and inspect history.

Observed defect on build0557d8f0a3f5ebe7: changing09:00 to10:00 and tapping Inbox silently left the editor. Reopening showed09:00 with no recovery/confirmation. The same state-resetting navigation functions served both clean and dirty editors.

Fix: snapshot the exact body/path at edit entry; one app-owned exit check protects breadcrumb navigation, page/file/model-settings navigation, new-file entry and Cancel. Dirty edits open the existing sheet with the target path, Keep editing and Discard changes. Dismissing the sheet keeps the draft and cancels the pending navigation. Unchanged or exactly reverted drafts leave directly. Saving owns the existing lock/CAS/revision transaction; the exit check never saves or creates a revision. A beforeunload listener requests the browser's standard protection while dirty, where supported; it does not establish recovery after OS termination.

Actual sidebar follow-up: new Japanese file saved v1, correction to10:00 survived Keep editing, explicit Save created v2, History v1 retained09:00, and Find files located the note by Japanese body text. Original input draft was held and restored without submission. Browser storage was not reset.

Regression: three browser cases first reproduced the missing confirmation on the old artifact. Built-app Chromium and Windows WebKit cover breadcrumb retention, exact reviewed Save/history/reload, explicit discard without a new revision, changed path, Cancel, Escape/dismissal, unchanged and reverted edits, and cancelled browser reload. Run `npm run build:app` then `npm run test:editor:built`; WebKit: `npm --prefix design/prototype run test:editor:built -- --browser=webkit --workers=1`. This is PC browser evidence, not physical iOS.

Remaining evaluation: unsent creation/schedule sheets, durable approval-review recovery, model preparation-to-first-answer friction, and longer dialogue/source selection. Do not treat a successful direct-edit flow as whole-app or model-quality acceptance. Durable editor drafts across OS force-close are not implemented by this exit check.

Public v178 follow-up: normal Update adopted the same page and active worker; restored appOffline. The public-origin synthetic file preserved Keep editing/Save, retainedv1/v2 after a separate discarded draft, and reopenedv2 after ordinary reload. No inference was needed. Windows WebKit had one later two-case startup timeout before Input appeared; a dedicated-port rerun passed4/4, but that earlier startup cause remains unproven.
# Reviewed backup recovery — 2026-10-27

Actual Windows sidebar use found a missing recovery action: a saved generated answer showed a conflict but could not be reviewed as a file. The recovery gate only admitted original notes. Build106af75337a630e1 allows explicit body recovery for saved generated text when immutable origin metadata and the complete referenced source versions match. Different origins or source versions refuse this path. Existing strict restore, whole-state CAS and atomic receipt rules remain.

The actual flow exported a local backup, verified identical reimport caused no canonical changes, edited an owned test note, reviewed the previous body and restored it as v3. History retained v1/v2, references and saved-copy metadata; an independently parsed final export showed all other notes, prior runs and dialogue turns unchanged. Private backup files were never published. The final conflict UI uses Messages instead of an internal storage key. Help documents the short recovery path.

This is PC recovery evidence, not a phone or model-performance result. Developer already offers Quick and Performance modes with one Run tests action and a local copyable report. Performance uses one bounded sample; load/first-token/generation/token/memory fields depend on the actual runtime metrics returned. No automatic upload or model download occurs. Sustained heat, output quality, OS termination and physical-device offline startup remain separate checks.

