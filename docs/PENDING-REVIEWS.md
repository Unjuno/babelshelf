# Durable correction review

Scope: ordinary note, managed settings, typed schedule and custom-tool-source correction proposals. New-note capture and new schedule creation are separate forms and are not made durable by this contract.

## Storage and authority

The existing IndexedDB settings store holds at most one `ui-v1-pending-correction` record. Schema1 contains `type: pending-correction`, creation time, the exact CorrectionProposal and optional originating dialogue-turn ID. The proposal preserves the complete expected target record, Before/After text, operation and dependency snapshots. It is inert local data, not approval, executable tool code or a new file-system backend. The UTF-8 JSON record is limited to2MB; oversized or malformed proposals fail without changing knowledge.

Staging validates the proposal against the current notes and refuses to replace a different pending proposal. Repeated staging of the same proposal is idempotent. The record is included in the existing local backup; structural/historical validation applies on export/import. A stale snapshot remains recoverable data, but a conflicting local pending record is never silently overwritten by restore.

Staging receives the active Send AbortSignal: an already stopped request or Stop during its transaction aborts the proposal write. If the transaction completed before Stop, the committed inert proposal remains available for manual review, but the stopped request does not open the review automatically. No proposal is replayed or approved to compensate for interruption.

## Reopen and resolve

Closing the review with Escape/overlay dismissal retains it. Input shows Review changes; selecting it rereads the record and validates current target/dependencies without generation or writes. A changed, withdrawn, protected or otherwise ineligible target leaves the proposal visible with Save disabled. Nothing automatically rebases, regenerates or approves a proposal on startup or backup restore. An invalid saved record is isolated behind Saved review unavailable and can be explicitly discarded without changing notes.

Save requires the exact pending-record snapshot as well as the existing complete target/dependency CAS. Note revision, correction receipt and pending-record deletion commit in one IndexedDB transaction. An abort retains all prior state, including the pending record. Duplicate approval is refused. Cancel compares the exact pending snapshot and removes only that record; it does not write a note revision. If another tab replaced the pending proposal, the old screen may neither approve nor discard the unseen replacement. It closes the stale view and rereads the current record.

Dialogue completion is acknowledged after the knowledge transaction. Failure to refresh or acknowledge does not repeat approval or erase the committed receipt. Existing history and Undo contracts remain unchanged. The optional turn ID is provenance and never authorization.

## Evidence and limits

Built Chromium and Windows WebKit cover reopen-without-approval, Save, Cancel, changed settings and replacement by another tab. An isolated production IndexedDB test covers reopen/backup, competing proposal refusal, stale-target refusal, duplicate Save and an intentionally aborted approval after queued writes. Node cases cover settings/schedule/custom-tool dependencies/generated-source snapshots and conflicting backup restore.

One actual prepared Bonsai2 4B local-sidebar correction on intermediate06bfae0ca4b35c48 changed a synthetic note's 北口 to南口. Escape/reload/resume retainedv1 until explicit Save createdv2; History keptv1, and Undo appendedv3. Final78571b1e36c3e0d6 adds stricter snapshot/source validation, typed pending-record conflict handling and staging cancellation, with fresh built-flow and transaction regressions. Publicv180 sidebar independently verified profile-review dismissal/reload/resume/Cancel with original Standard settings unchanged and appOffline; see SITES-DEPLOYMENT.md. This is not broad model quality, physical iOS/Android, OS force-close or all review-type recovery acceptance.
