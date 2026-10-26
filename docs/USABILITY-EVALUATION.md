# Task-based usability evaluation

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
