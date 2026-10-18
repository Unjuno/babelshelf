# Implementation and acceptance map

Updated 2026-10-18 JST. This maps the implemented flows to their contracts and remaining work. Intended behavior is [PRODUCT-SPEC.md](PRODUCT-SPEC.md); evidence is [MVP-ACCEPTANCE.md](MVP-ACCEPTANCE.md) and [TEST-RESULTS.txt](TEST-RESULTS.txt). It does not certify completion.

## Shared architecture

The native product entry in design/prototype/product uses the accepted UI and canonical adapter in design/prototype/src, with shared baseline core/worker modules in dist/. Native controls do not modify the protected phone-preview runtime. The browser runs inference locally; the localhost server only serves files.

IndexedDB is the knowledge source of truth. Original media bytes, extracted records, dialogue/receipts and model/runtime assets have separate roles. The Memory tree projects canonical paths; exports/backups are explicit local files. No reset or parallel transient knowledge store is an acceptable migration.

## Flow map

| Flow | Implementation contract | Remaining evidence/limit |
|---|---|---|
| Capture/import, reopen, search, original, direct edit/move/history | [Storage](STORAGE-CONTRACT.md), [process check](OFFLINE-PROCESS-CHECK.md) | Physical storage/IME/touch and actual capacity failure |
| Natural input, dialogue/compaction, read-only tool activity | [Conversation](CONVERSATION-CONTRACT.md), [planner scope](PLANNER-SCOPE.md), [activity](HARNESS-ACTIVITY.md) | Broader semantic intent, language and summary fidelity |
| Reviewed correction, expected revision, receipt/Undo, exact answer Save | [Corrections](CORRECTION-CONTRACT.md), [settings](SETTINGS-CONTRACT.md) | Preserve finite supported operations; no generic protected-record rewrite |
| Local text/model registration, explicit preparation, Stop/unload/reload | [Runtime evidence](MODEL-RUNTIME-VERIFICATION.md), [custom models](CUSTOM-MODELS-CONTRACT.md) | Runtime licensing, physical resources; formats/candidates are not compatibility |
| Raw attachments, prepared readers and on-demand original citations | [Media](MEDIA-HARNESS.md), [input readings](INPUT-READINGS.md), [speech](SPEECH-CONTRACT.md), [OCR](OCR-CONTRACT.md), [PDF](PDF-CONTRACT.md) | Hardware capture/accuracy, general vision/video frames and mapped video time |
| Canonical schedules, attempts, results and notification-only deletion | [Schedules](SCHEDULE-CONTRACT.md) | Foreground only; no closed-PWA or OS-delivery guarantee |
| Local backup/restore with graph/hash/conflict checks | [Backup](BACKUP-CONTRACT.md), [settings recovery](SETTINGS-RESTORE.md) | Bounded200MB; arbitrary branch reconciliation/streaming absent |
| Installed PWA, reviewed updates and cold cached assets | [Installation](PWA-INSTALLATION.md), [updates](PWA-UPDATE-CONTRACT.md) | Physical Android/iPhone and OS-disconnected all-function acceptance |

## Next actions

Choose a material remaining gate from [REMAINING-GATES.md](REMAINING-GATES.md), or a reproduced normal-use defect. Trace its data/permission dependency, implement the bounded change, and verify the actual flow. Keep failed observations and exact build/profile scope. Do not restart completed adapter work, broaden permissions or run repeated model comparisons to improve a score.

Run checks appropriate to the changed component. Standard commands are in the root README; browser QA scripts require explicit fresh output/profile paths unless designed to use a retained prepared installation. Inspect live handles before repeating a running check. Real inference must use actual prepared local assets and record its source/runtime pins.

## Completion boundary

The full objective includes all requested storage, harness, source, model, task and cold-offline flows. Audit each against current authoritative evidence before any completion claim. Node tests, PC native browser, installed Chrome standalone, synthetic capture/touch and physical Android/iPhone are distinct scopes. Missing physical access, runtime provenance or a passing narrow sample must not be converted into a whole-MVP pass. The latest user authorized owner-private Sites publication for device checks; see SITES-DEPLOYMENT.md for its exact scope. GitHub push remains excluded.
