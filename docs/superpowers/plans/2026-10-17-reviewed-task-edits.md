# Reviewed typed schedule edits

**Goal:** Natural-language edits to an existing schedule propose typed changes, then use the existing full Before/After confirmation, atomic correction receipt/history and append-only Undo. Memory and Schedule continue to share the same canonical record.

**Architecture:** Extend the existing correction operation union with `schedule.patch`, not arbitrary Markdown rewriting of system records. Accept only prompt/repeat/time/days/date/monthDay/interval/unit/notify fields. Preserve enabled state, timezone, ID/path, metadata and history; activation remains the existing user-controlled toggle. Validate the merged Task before review and again when approved. Exact expected-record CAS rejects intervening body, state, metadata or cursor changes. Reuse typed task revision/cursor semantics for UI saves, approved patches and Undo. Store compact changed-field/hash receipts, reconstructing checked changes from retained revisions during backup validation. Ordinary note edits and protected settings/tools/executions/notifications stay unchanged.

**Scope:** Existing registered active local-zone schedules only. This unit does not create a new schedule from natural language, execute a prompt during review, or enable a disabled task. Those remaining routes are separate work, not implied by an edit intent. Scheduled prompt text is untrusted data. Model output alone never writes a record.

- [x] RED/GREEN tests for typed patch review/no mutation, valid fields/Task invariants, activation/path/permission rejection, exact CAS/cursor conflicts, retained history/Undo, compact receipts/backup tampering and source-only bounded real adapter calls/Stop.
- [x] Implement typed Task revision helper and schedule-patch correction module; integrate through existing resolution/proposal/approval/Undo/receipt validator and canonical UI putTask.
- [x] Keep full review UI; block foreground task claims while correction review owns the target. Run tests/builds and independent review.
- [x] Native actual Bonsai proposal for a new disabled QA schedule, review/no preapproval write, Save/Schedule+Memory consistency, history/Undo, stale review rejection and local backup/restore. Record environment/builds and local commit. Whole objective remains active.

Result: Unit25 in TEST-RESULTS.txt. Real IndexedDB8 checks are separate from two actual Bonsai proposals. Native7934 schedule behavior passed; final0283 adds only measured dark Schedule contrast repair (names1.18→11.52, metadata2.50→8.89). No full/device acceptance claim.

The user's autonomous implementation instruction supplies authorization for this ordinary implementation choice; no deployment, network permission expansion or data reset is introduced. Broader settings/tools edits, schedule creation, media/custom/accuracy/storage/device/full-process offline gates remain pending.
