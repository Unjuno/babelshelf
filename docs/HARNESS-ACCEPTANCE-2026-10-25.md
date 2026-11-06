# Harness acceptance — 2026-10-25

## Latest follow-up — 2026-10-26: local Vision import and real offline image answers

Build `9873e37317e6a138` (135 pinned app assets) passed a real Windows Chrome 156.0.8078.47 single-image flow. The same isolated QA profile retained its earlier notes and model packages. With browser networking disabled, the selected LFM2.5-VL 450M package was locally supplied and fully verified (13 files / 319,224,935 bytes; model revision `24e63007ff1aaafbde27c89eb01a0513f4f61482`; Transformers.js 4.3.0; q4f16 WebGPU adapter). Runtime setup was a separate explicit action against the local app server. No Hugging Face or other external request occurred.

After closing the profile and reopening it offline, the test loaded the existing Text model, attached a synthetic 960×320 PNG, and asked `What code is printed on the attached image? Reply with the code only.` Real Vision generation returned `MAPLE-6381`; Text residency was released for the Vision operation. The answer reused the exact same-question Vision result, with actual Vision model identity in the receipt and the immutable revision-1 observation as its source. It did not run Text planning or Text generation again. The source preview displayed the original PNG and its observation. Send-to-answer wall time was 16,849 ms in this one trial; this is not a general throughput or device performance benchmark, and vision token counts were not instrumented. Save review contained the same answer; after explicit Save, a second cold offline process reopened the exact saved file. Before/after archives confirmed all prior QA notes, settings revisions and original/processing records were retained. Offline external requests and page errors: zero.

Evidence: `outputs/harness-current/vision-final-current-20261026/evidence.json`, `source-preview.png`, and before/answered/saved/final archives. The recorded `answerExecution: current-vision-result` and `answerModel` identify the actual execution route. It proves single-image answering, not a post-Vision Text generation, sampled-video acceptance, arbitrary visual accuracy, physical iOS/Android, or sustained GPU stability.

The original failure was diagnosed from its retained processing receipt: the old build rejected local import after about 70 ms because it required an unprepared inference runtime first. The old QA then waited 300 seconds for an impossible success label. A 12.5 KB core asset worker now handles hashing/cache/status independently of the optional inference worker. Worker factory switching preserves the existing lease/Stop lifecycle. Preparation waits for an initial status check rather than reporting a false busy error; Stop prevents delayed import. Asset errors remain next to the selected model after the toast disappears. Files-only readiness is distinct from runtime readiness, with explicit Set up when needed.

An intermediate real trial on build `33a0ce8cb9a100ea` successfully generated the same Vision answer, but the format suffix after `?` made the intent route fall through to Text planning. The small Text model chose capture and later failed with `Invalid answer`. The final code accepts a bounded output-only suffix for explicit attachment questions, clears unrelated dialogue, and delivers an already generated same-question image answer with host-owned sources. Different prompts, multiple inputs, edited results, withdrawn originals, nondefault response preferences and requested transformations do not use this shortcut. Source identity is checked again before delivery; saving still requires the existing review.

Current regression checks: app Node suite 859/859, turn-intent/scope/open 23/23, built-product checks 6/6, Settings browser suite 8/8, type/build/static/pin checks and protected mobile runtime checks passed. The whole `test:quality` chain was not repeated in this follow-up; its prior exact-build result remains below. No deployment or push occurred.

## Previous follow-up — 2026-10-25: real Speech → Text, offline save and full regression

The current local production build is `d97a31e96c553918` (134 verified shell assets). The complete `npm run test:quality` command finished successfully after an initial run lost its local Vite test server during the Custom Tools browser suite. That interruption caused downstream `ERR_CONNECTION_REFUSED` failures; the 31-test suite passed when rerun on its own, and the full quality command then passed on rerun. Root Node tests passed 853/853, turn intent/scope/open tests 23/23, Agent coordinator 13/13, Custom Tools 31/31, schedule 3/3, settings 7/7, and the PC Chromium and WebKit Developer handoff suites 15/15 each. The full gate also passed static/pin checks, product build/acceptance, offline UI suites, app update, separate-process offline checks, and installed-PWA cold restart. A normal Vite dynamic-import analysis warning remains for the custom runtime module; its execution is covered by the browser suite.

On this exact build, an isolated Windows Chrome PWA (156.0.8078.47) completed a **real offline media-to-answer loop** with the pinned Whisper tiny and LFM2.5-230M QAD Q4_0 models. The downloaded Whisper package is revision `ff4177021cc41f7db950912b73ea4fdf7d01d8e7`, runtime Transformers.js 4.3.0, WASM q8, 43,600,635 bytes across the seven manifest assets. A synthetic local WAV was transcribed offline to `The emergency marker is cedar 472.` at 0–3 seconds. The transcript was reviewed and saved as original revision 1 at `Attachments/Transcript-06e8bb5c-f131-4e7f-afd1-7bb777da3d50.md`. The real LFM model was then loaded after Speech, asked for the numeric value from the currently open transcript, and returned `472`. The citation validated against that transcript revision, and the source preview linked back to the transcript and original WAV with estimated 0–3 second timing. The answer `472` was confirmed in the save form and saved unchanged; the answer generation receipt did not increase. A cold offline browser restart reopened the exact saved file. Before/after backups confirmed the profile's prior records were preserved. All offline phases reported zero external requests and no page errors. Evidence: `outputs/harness-current/speech-role-current-20261025/run-21/evidence.json`.

This is one deterministic, synthetic English speech trial on Windows PC Chromium. It does not establish human-speech accuracy, multilingual ASR quality, general answer quality, iOS behavior, or arbitrary media compatibility. The model returned the asked-for number correctly; it did not demonstrate reliable extraction of the full phrase and number in a single answer.

A bounded Vision preflight then used the manifest-pinned LFM2.5-VL 450M package (13 local files, 319,224,935 bytes; revision `24e63007ff1aaafbde27c89eb01a0513f4f61482`; Transformers.js 4.3.0; q4f16). On the same isolated PC Chrome profile, the app selected the model and opened local file selection, but did not reach `Verified assets` within 300 seconds. After timeout the UI still showed `Not prepared`; no external requests or page errors were recorded. This did not verify local asset import, model execution, or Text → Vision → Text. It is an observed PC Chrome preparation-path failure, not evidence that the model itself cannot infer. Screenshots and evidence: `outputs/harness-current/vision-role-current-20261025/run-03/`.

The root-cause fix found while running the scenario is covered by a new regression: “currently open transcript file” had not been recognized as an explicit file-scope request because the file name was allowed only after the phrase “open file”. The deterministic route now binds that request to the pinned current file and clears unrelated dialogue evidence. Targeted intent/scope tests pass as recorded above.

## Current follow-up — 2026-10-25

The latest full `npm run test:quality` gate passed against local product build `60a5edd9c61b12c5` (134 verified assets), including root and prototype Node suites, intent/coordinator, type/static checks, production shell, Chromium/WebKit UI, app-update, separate-process offline and installed-PWA cold-start checks. Product-free offline fixtures prove only the scope each fixture exercises; the real-model scenario below is separately identified. Physical iOS/Android are separate.

An isolated Windows Chrome profile already containing the pinned LFM2.5-230M model was run with browser networking disabled. The ordinary user input `Hi. Reply with a brief greeting.` previously ended in `Invalid answer` because `plainConversationRoute` did not recognize the short imperative greeting and sent it to the structured action planner. The route now recognizes short `reply with` / `respond with` greeting requests, while the existing source-reference guard keeps saved-note requests on the evidence path. The matching regression is in `conversation.test.mjs`. With the fix, the actual local LFM2.5-230M QAD Q4_0 model produced `Hello! How can I assist you today?` in 76,377 ms. Configured route was Wllama 3.8.1 / llama.cpp b11364, CPU-WASM. Browser external requests: zero. This proves one source-free answer path on this Windows PC, not grounded answer quality or iOS performance.

In that QA-only isolated profile, the generated answer was shown unchanged in the Save note review, explicitly approved, then found and opened after closing and relaunching the browser profile offline. The saved file body exactly matched the generated answer. Evidence is in `outputs/harness-current/lfm230-route-fix-20261025/`. The answer correctly has no current source; no claim of citation-backed answering or knowledge ingest is made.

**A: accepted at code and full Windows PC browser regression scope.** The role lease/lifecycle, typed exclusive answer scopes, Send Application boundary, shared reader-save transaction path and full quality gate passed.

**B: partially verified; not accepted.** On exact local build `60a5edd9c61b12c5`, the isolated installed Windows Chrome PWA used real Wllama 3.8.1 / llama.cpp b11364 CPU-WASM LFM2.5-230M QAD Q4_0 (149,081,056 bytes; SHA-256 `e75f83268de11b2a1bcfab5f3b5c5c0c97569ddbbc0990aad88437e45b8ba292`). With Chromium networking disabled, it ingested a synthetic local Markdown source, cold-restarted, retrieved its exact excerpt, generated `24 litres` in 30.694 seconds with exact revision/range citation, opened the citation preview, reviewed and saved the identical answer once (one knowledge-answer call), then cold-restarted in a third browser process and reopened the saved answer. All three launches reported the expected build; external request count was zero. Evidence: `outputs/harness-current/lfm230-grounded-final-verified-20261025/`. The profile and fixture are QA-only; no user-origin data was used.

Still open: real current-build Vision inference and Text→Vision→Text role transition; arbitrary original PDF/image/audio/video ingest-to-answer quality; Bonsai WebGPU generation and fit/performance. The run above verifies the narrower Speech→Text role handoff. Earlier Bonsai 4B evidence reports the Windows Intel D3D12 device loss (`DXGI_ERROR_DEVICE_HUNG 0x887A0006`); the 2B load did not reach ready within 180 seconds after that loss, which does not prove independent incompatibility. Prior evidence remains under `outputs/harness-current/pc-bonsai4b-offline-20261025/` and `outputs/harness-current/pc-bonsai2b-offline-20261025/`.

Physical iPhone/iOS and Android checks, other GPU backends, model memory fit, sustained speed/thermal behavior, broad multilingual answer quality, general original-media ingest/citation quality and the full Speech/Vision role matrix remain open. The cited Markdown fixture proves one saved-memory path, not arbitrary media extraction. No deployment was performed.

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

## Additional prepared package

The manifest-pinned LFM2.5-VL 450M q4f16 package is stored under the ignored
local `outputs/harness-current/vision` directory. Its 13 file sizes and SHA-256
hashes matched revision `24e63007ff1aaafbde27c89eb01a0513f4f61482`. Asset
preparation is not model inference evidence. Existing Whisper files are also
available locally, but real reader-role switching remains open.
