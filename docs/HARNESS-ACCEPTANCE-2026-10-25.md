# Harness acceptance — 2026-10-25

Baseline: `7cdaae4309e84b0549c64e810adb181d14a9463f`, branch
`codex/ui-design-handoff`. Current verification is against working-tree changes,
not a published Site artifact. No user storage has been cleared or migrated.

## Implemented boundaries

- Speech/Vision hooks now delegate inference lease acquisition to the reserved
  client operation after idle resident-owner release. Both use
  `ReaderOperationClient`; final cleanup owns its captured lease, not a global
  mutable release slot. Vision model revision changes invalidate its effect.
- `groundedAnswer(dependencies, request)` replaces 14 positional arguments.
  Exclusive scope data distinguishes conversation, knowledge, opened file and
  current attachments. Runtime scope/calculation/source validation remains;
  Send, foreground schedules and existing answer tests use this API.
- Actual Send uses `createResolvedActions` for Memory read/search, answers and
  summary-based capture, schedule proposals and correction proposals. UI keeps
  navigation/review/turn commits. Earlier-message inspection and scoped-file
  binding still use the existing adapters; this is a bounded extraction.
- Four reader save methods share `saveReading` without changing builders,
  store schema, original bytes or transaction helper guards. Atomic submitted
  input and post-note-commit dialogue acknowledgement remain distinct.
- Actual browser regression exposed an existing Connection-version mismatch:
  the worker rejected `schemaVersion: 1`. Its whitelist now accepts the current
  version and legacy absence, while invalid/unknown versions remain denied.

## Evidence collected so far

| Command / environment | Result and scope |
|---|---|
| `node --test design/prototype/tests/speech-control.test.mjs design/prototype/tests/vision-control.test.mjs design/prototype/tests/inference-lease.test.mjs` | 24 passed. Controlled Workers plus real lease manager; not model inference or React-mount acceptance. |
| Four answer-related existing Node test files | 127 passed after positional-to-object migration. Source scopes, pure calculations, dialogue-only no-enumeration, Stop, context/source validation. |
| `node --test design/prototype/tests/resolved-actions.test.mjs` | 5 passed. Read-only application paths, exact answer return, Stop, clarification, malformed scope; inference here is controlled and not model-quality evidence. |
| Knowledge/input-submission/reviewed-file-save/vision-text Node files | 42 passed. Existing source/commit/acknowledgement contracts. |
| `node scripts/qa/media-save-conflicts.mjs research/harness-current-media` | Actual PC Chrome isolated IndexedDB: PDF/OCR/Transcript/Vision saved once; duplicate ID, duplicate original and withdrawn-original attempts reject without snapshot changes. Controlled readings, not recognition accuracy. |
| `node --test tests/connection-policy.test.mjs` | 4 passed, including an actual `formatPreference` versioned Connection record, Offline, legacy records and unsupported versions. |
| TypeScript and `npm run check` | Passed at the recorded intermediate stages. |
| `npm --prefix design/prototype run check:runtime` | 28 protected files unchanged. |
| `npm run test:quality` | First run stopped at Tools browser preparation (2 failures); diagnosed version mismatch and fixed. Repeat run completed with exit code 0 on product `9842d1b34aceb052`: PASS at PC regression scope. |

Intermediate product `39d70d6e2b657eda` predates the Application extraction.
Current quality-run product is `9842d1b34aceb052` / 134 verified shell assets.
Its Tools browser suite passed after the Connection fix, including actual
offline QuickJS execution, failure/Stop, local calculator capability and file
context persistence. Remaining quality gates also passed, including the Chromium/WebKit diagnostic UI checks, data-preserving app update, isolated offline process checks, and installed Chromium PWA cold restarts with the fixture server stopped. These tests do not run real model inference.

## Model preparation and acceptance limits

The manifest-pinned LFM2.5-VL 450M q4f16 package was downloaded to the ignored
local `outputs/harness-current/vision` directory. All 13 sizes and SHA-256 hashes
matched revision `24e63007ff1aaafbde27c89eb01a0513f4f61482`.
Existing local LFM2.5-230M GGUF and Whisper assets are available for reuse;
their presence is not current-run load/generation evidence.

**A: not yet accepted.** Finish the full regression and product error/reload
flows, strengthen the production-entry lifecycle checks (including selection
changes/cleanup failures), and review all residual Send execution seams.

**B: unverified.** Still run one isolated, fact-pinned ingest/restart/offline
search/source/real-answer/exact-save/restart/read flow, plus real Text →
Speech/Vision → Text. Record actual model identities, browser/backend, build,
network isolation and server/restart conditions. Do not substitute controlled
inference or the existing no-model offline search for these gates.

Physical iOS/Android, OS-level Airplane Mode/force-close, eviction, GPU memory
fit, sustained speed/thermal behavior and broad multilingual quality remain
separate unverified requirements. No new phone rerun has been requested.
