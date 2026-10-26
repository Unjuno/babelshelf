# Task-based usability evaluation

## 2026-10-26 — direct editing and navigation

Scope: existing Windows Codex sidebar profile, local product build6178c8ec9ee2f989; accepted UI and canonical IndexedDB data retained. Synthetic Japanese note only; no inference, model acquisition or user-document export needed for this task.

Task: create a note, correct its meeting time, navigate through its breadcrumb, then find the saved note and inspect history.

Observed defect on build0557d8f0a3f5ebe7: changing09:00 to10:00 and tapping Inbox silently left the editor. Reopening showed09:00 with no recovery/confirmation. The same state-resetting navigation functions served both clean and dirty editors.

Fix: snapshot the exact body/path at edit entry; one app-owned exit check protects breadcrumb navigation, page/file/model-settings navigation, new-file entry and Cancel. Dirty edits open the existing sheet with the target path, Keep editing and Discard changes. Dismissing the sheet keeps the draft and cancels the pending navigation. Unchanged or exactly reverted drafts leave directly. Saving owns the existing lock/CAS/revision transaction; the exit check never saves or creates a revision. A beforeunload listener requests the browser's standard protection while dirty, where supported; it does not establish recovery after OS termination.

Actual sidebar follow-up: new Japanese file saved v1, correction to10:00 survived Keep editing, explicit Save created v2, History v1 retained09:00, and Find files located the note by Japanese body text. Original input draft was held and restored without submission. Browser storage was not reset.

Regression: three browser cases first reproduced the missing confirmation on the old artifact. Built-app Chromium and Windows WebKit cover breadcrumb retention, exact reviewed Save/history/reload, explicit discard without a new revision, changed path, Cancel, Escape/dismissal, unchanged and reverted edits, and cancelled browser reload. Run `npm run build:app` then `npm run test:editor:built`; WebKit: `npm --prefix design/prototype run test:editor:built -- --browser=webkit --workers=1`. This is PC browser evidence, not physical iOS.

Remaining evaluation: unsent creation/schedule sheets, durable approval-review recovery, model preparation-to-first-answer friction, and longer dialogue/source selection. Do not treat a successful direct-edit flow as whole-app or model-quality acceptance. Durable editor drafts across OS force-close are not implemented by this exit check.
