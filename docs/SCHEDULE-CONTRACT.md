# Canonical tasks, runs and notifications

Tasks are registered notes under Schedule with app-owned `ui.recordType=schedule`. Their Markdown body contains validated recurrence/time/timezone/enabled/notify JSON and the exact prompt after `## Prompt`. Arbitrary Markdown dropped into the directory never grants execution authority. Task filenames use the local creation date and UUID; structured body/cursor determines due time. Moving or renaming does not reschedule. Memory edits append a revision and update the same task seen in Schedule. Restored new tasks require explicit review before execution.

Each occurrence is identified by task ID, definition signature and due instant. Claiming is one IndexedDB read/write transaction, including withdrawn runs in duplicate checks. The run records task revision, due instant, attempt, owner/lease, prompt, output/error, sources and model metadata. It uses a90-second lease with20-second heartbeats. Expired runs become interrupted and require explicit retry. Failure/stopped/missed attempts retain one occurrence ID and append revisions. Skip is explicit and does not invent an inference attempt.

New tasks are paused. Run now is explicit and can consume a future occurrence early. Enabled tasks are checked while the page is visible, approximately every15seconds. More than60seconds overdue is recorded missed without generation; Retry or Skip is required. Another device timezone requires review. No closed/suspended-PWA wakeup or operating-system notification delivery is promised.

Scheduled generation is isolated from interactive conversation. It only reads evidence and generates prose; no capture/edit/delete tools or external operations. A successful result must have valid current source references. Result Save note uses the existing output review without regeneration. Runs are read-only in Memory; a running run cannot be deleted. All revisions remain.

Notifications are separate versioned outcome notes linked to task/run IDs. Read/unread is a canonical revision. Opening links to the actual result/task; deletion withdraws only the event and never deletes the task/run. Recovery is separate. This is an in-app inbox, not push delivery.

Measured state-transition and browser evidence is in TEST-RESULTS. Actual successful scheduled inference, physical-device timing, sleep/resume behavior and full-feature offline acceptance remain pending.
