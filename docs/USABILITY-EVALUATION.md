# Task-based usability evaluation

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
