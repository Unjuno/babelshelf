# Canonical tasks, runs and notifications

Tasks are registered notes under Schedule with app-owned `ui.recordType=schedule`. Their Markdown body contains validated recurrence/time/timezone/enabled/notify JSON and the exact prompt after `## Prompt`. Arbitrary Markdown dropped into the directory never grants execution authority. Task filenames use the local creation date and UUID; structured body/cursor determines due time. Moving or renaming does not reschedule. Memory edits append a revision and update the same task seen in Schedule. Restored new tasks require explicit review before execution.

Each occurrence is identified by task ID, definition signature and due instant. Claiming is one IndexedDB read/write transaction, including withdrawn runs in duplicate checks. The run records task revision, due instant, attempt, owner/lease, prompt, output/error, sources and model metadata. It uses a90-second lease with20-second heartbeats. Expired runs become interrupted and require explicit retry. Failure/stopped/missed attempts retain one occurrence ID and append revisions. Skip is explicit and does not invent an inference attempt.

New tasks are paused. Run now is explicit and can consume a future occurrence early. Enabled tasks are checked while the page is visible, approximately every15seconds. More than60seconds overdue is recorded missed without generation; Retry or Skip is required. Another device timezone requires review. No closed/suspended-PWA wakeup or operating-system notification delivery is promised.

Scheduled generation is isolated from interactive conversation. It only reads evidence and generates prose; no capture/edit/delete tools or external operations. A successful result must have valid current source references. Result Save note uses the existing output review without regeneration. Runs are read-only in Memory; a running run cannot be deleted. All revisions remain.

Notifications are separate versioned outcome notes linked to task/run IDs. Read/unread is a canonical revision. Opening links to the actual result/task; deletion withdraws only the event and never deletes the task/run. Recovery is separate. This is an in-app inbox, not push delivery.

Existing local-zone schedules also support reviewed model-originated typed patches through CORRECTION-CONTRACT.md. Prompt/condition/notify changes share the dedicated editor's canonical revision/cursor rules; activation and timezone are preserved. A pending review blocks same-page foreground claims. Other clients or execution-cursor changes invalidate approval/Undo through whole-record checks. Memory and Schedule project that same record.

## New schedules from Input

A finite `schedule` planner action proposes a new scheduled prompt. A separate bounded local generation receives the current instruction, device date/time/zone and the same untrusted bounded dialogue used for clarification. It returns either all eight recurrence/prompt fields or one short clarification question. Incomplete/unknown/invalid fields, malformed Unicode, past one-off occurrences and model-supplied activation/timezone/identity/path/tool permissions refuse. The harness supplies local timezone, enabled=false and notify=true. This does not establish semantic correctness of date extraction: the editable review and next-occurrence preview are required. An existing-file correction remains a separate exact-target patch.

The existing New schedule sheet presents the proposed prompt and conditions, Paused status, Cancel and Save. Repeat selection keeps this same draft. The user can correct fields before saving. Cancel writes no task. Save validates the reviewed current fields and creates one registered canonical task; its session-owned UUID is also the new filename suffix. Repeated saves with that ID refuse even if the existing record is withdrawn. Existing records keep their IDs/paths. A committed save followed by refresh failure is acknowledged as saved and closes the review, rather than generating a new task on retry. The source instruction/proposal remains in dialogue activity; the saved path links the outcome. No task or execution is inferred merely from a successful proposal receipt.

`schedule.propose` records start/result/failure/Stop on the Input turn. History/summary/receipts do not authorize execution. Pending review is session-only and cannot auto-save or replay after restart. New tasks remain paused; explicit Enable or Run now uses the existing foreground-only rules. This creation path installs no tools, grants no network access and creates no OS notification timer. Date interpretation and clarification quality require actual model/device evidence in TEST-RESULTS.txt.

Measured state-transition and browser evidence is in TEST-RESULTS, including actual manual foreground scheduled inference (Unit3). Physical-device timing, sleep/resume behavior, closed-PWA execution and full-feature offline acceptance are separate unverified or unsupported gates.

## Notification result snapshots (Unit36)

New notification events pin taskRevision, runRevision and attempt. Title/prompt and the result body come from the claimed task and exact terminal execution revision, so later task edits or occurrence retries do not replace the old event's result. Both the claimed notify policy and current task notify flag must allow a new event; disabling notifications during execution is respected. Opening a new notification result shows the retained execution revision and attempt; Open current file deliberately navigates to the live canonical file. Existing legacy notifications remain byte-identical and label their unpinned link Open current result.

Backup verifies new pins against retained task/run revisions, exact body/title, attempt and definition. Missing/forged pins refuse; legacy unpinned records remain readable. Read/unread and notification-only deletion preserve the source task/run. These are in-app outcomes, not a closed-PWA timer or OS push guarantee.


## Retained execution display (Unit50)

Schedule status derives from both same-page activity and the canonical execution matching task ID, definition and due instant. A retained running record must not become Paused merely because its original page closed. Its action is Check execution. The existing transactional claim remains authoritative: another live owner refuses; checking an expired running claim records Interrupted without executing. Retry is a separate explicit action. The display does not guess lease expiry or guarantee that a closed process remains alive, and it does not add background execution.

Unit50 native PC evidence covers Memory-edited task reflection, real process interruption, explicit expired-claim check, an actual unprepared-model failure on Retry, historical notification pins and notification-only deletion. That failure is not successful inference or a timed-execution/device acceptance result.
