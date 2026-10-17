# Current requirements and next work — 2026-10-17 JST

The accepted specification is [docs/PRODUCT-SPEC.md](docs/PRODUCT-SPEC.md). It supersedes the earlier bottom-toggle UI brief and chronological design notes.

## Current handoff after Unit46

Model-independent work has superseded the historical Unit31 source-rescue approach below. Unit34/45 share a local inference port with Stop and model/runtime revision lifecycle guards; this is not arbitrary custom-model compatibility. Unit35 implements finite reviewed appearance/model-selection settings patches; Tools definition model edits remain pending. Unit42/43 make folder rename and delete/Trash recovery atomic with canonical note/history metadata. Unit44 exposes selected-revision Markdown downloads separately from full-state brainpacks.

Unit46 confirms current-build PC offline-context capture/reopen/Japanese search/source/direct edit/history/TXT+MD import/reindex/backup/conflict refusal without inference. Unit47 separates read-only speech startup status from processing busy state; pending speech-worker exclusion and real prepare/transcribe locks remain. Controlled regressions and one immediate native offline-reopen search pass; broader startup timing/device acceptance remains open. Actual browser-process termination, physical devices, broader media/custom adapters and semantic quality remain open. Keep the full objective and historical failures below; see TEST-RESULTS.txt for exact scope.

## Accepted interface

- One natural-language input/results surface, compact photo/voice/Send controls; no sessions, branding header, sidebar, hamburger or bottom tabs.
- Upper-left glass Input button. Touch/pen tap returns to Input. Mouse/trackpad click opens a persistent menu, a destination click selects, and clicking Input again returns to Input. A touch/pen 50ms hold reveals a curved Memory / Schedule / Notifications / Settings menu; slide and release selects. Stationary release closes the menu and returns to Input. Touch/pen has no release-then-tap menu; mouse navigation intentionally stays open after click. Keyboard/screen-reader alternatives remain.
- Memory starts at Home: Inbox, Notes, Files. Navigate folders and breadcrumb ancestors. Internal Schedule/Notifications storage is visible only on explicit upper-level navigation.
- Protected storage roots, at most five stored folder levels, direct correction and retained history. Home is a display grouping; Files labels Attachments.
- English controls, multilingual content, readable text, large targets, glass model-choice sheets, no instructional paragraphs.
- Separate Text and Decision role selection/preparation. Bonsai 2 4B/2B retained; Open d1 Omni 600M/3B are decision candidates, not installed runtimes.

## Current integration and remaining gates

The accepted UI uses the existing canonical IndexedDB store. Memory, preferences, foreground schedules/execution records/notification events, continuous dialogue, reviewed ordinary-note correction/Undo, durable originals and full-state brainpacks are connected. Local Bonsai 4B, Whisper tiny, PDF text layers and PNG/JPEG OCR have scoped PC browser evidence in docs/TEST-RESULTS.txt. Unit18 adds reviewed image/PDF Use text and atomic Send alongside TXT/MD, with canonical source marks; see docs/INPUT-READINGS.md. Unit19 adds automatic prepared image/PDF/audio/video-audio reading on Send, with truthful extraction/coverage status and the same atomic storage. The projection is not disk-backed Markdown files.

Remaining work must preserve the full product objective:

Unit31 now passes the ordinary retained-context first-code -> anaphoric split -> exact reviewed new-note Save/reload/Memory lookup/backup-restore flow on PC6175aef41bab4fb2. The planner still proposes old14/user; a separate actual4B competing-speaker decision selects latest84/assistant before the original-only deterministic operation. See research/evaluations/subject-original.md. This is not universal chronological/semantic accuracy: the broader resolver failed an older-assistant control and is not used for same-speaker chronology. Capture remains unchanged. Keep all other whole-goal gates below.

Unit29's same-weight official CPU reference reproduces all four retained WebGPU outputs/counts, including wrong old-subject selection. See research/evaluations/reference-cpu.md. Do not assume these failures prove a WebGPU-only defect or change app providers/engines on that basis. Those matching observations did not themselves fix ordinary source binding or prove broad numerical parity; Unit31 above adds the separately tested recovery.

Unit30 verified the approved2B asset and actual PC WebGPU generation/offline-resource reload/Stop, but its first-message, crowded routing, JSON and literal-split controls fail. See research/evaluations/bonsai-2b.md. Normal selection stays4B; Unit30 did not repair source binding. The comparison route model selector is diagnostic only, not a new normal routing policy or evidence of broad2B task/media/device acceptance.

Compaction transport now avoids application-added recursive escaping, with three actual public4B comparison cycles retained in research/evaluations/compaction-carry.md. Exact line-break and broader semantic retention still fail in that sample; no summary repair or whole-MVP completion follows from the transport fix.

Immediate reproduction: Unit27 offline normal first-message code recall succeeded, but the next Japanese two-line transform selected recall/index13/user from a similar archived instruction and echoed the current request. D1's transform classification deferred correctly; Bonsai's action/target choice failed. Original82turns and all records remain. Address this current-versus-archived-intent ambiguity using public synthetic fixtures and normal integration; do not erase the failure or infer a fix from isolated operation-selection success.

Unit28 separates the current request and adds common audited text.inspect after indexed recall/transform. Native5ca first-message recall/read/answer succeeded, but identical follow-up STILL selected old13/user and split that instruction at a comma. All84turns remain; no wrong result was saved as a note. This historical failure precedes the Unit31 recovery above.31 public actual4B comparisons include failed stronger/concise prompts, standalone intent, explicit numeric indices, target-only and relative/role selectors. Do not deploy those failed alternatives or declare source selection fixed. Preserve source-safe deterministic operations; next investigation must account for actual normal-context failures rather than tune only the small public fixture. Compatibility/numerical/template limits and broader semantic fidelity remain unproven as documented.

1. Prepared empty-page PDF OCR is connected; broad scanned-layout fidelity, general image/video-frame understanding and verified video-container timing remain open; retain originals, bounded coverage and processor provenance. Current OCR Japanese sample contains errors.
2. Decision and compatible custom model/runtime adapters require their own pinned artifacts, compatibility and license verification. Candidate registration is not execution support; no provider/cloud fallback.
3. Existing registered local-zone tasks use typed reviewed patches and whole-record expected snapshots, shared cursor semantics and atomic receipts/Undo. New natural-language tasks use bounded typed proposals/clarification and editable review, stable creation identity and paused Save; broader date/prompt/language fidelity remains under evaluation. Typed settings/tools model edits remain pending. Ordinary-note semantic correction remains source-only; attaching a file does not expand its factual rewriting authority.
4. Broader multilingual relevance/semantic accuracy, large archives/history retention, divergent-history reconciliation and storage pressure. Current bounded tests are not universal accuracy/capacity evidence.
5. Physical Android/iPhone touch, microphone/camera, GPU/resource limits and accessibility. PC browser and simulated phone frame are separate evidence.
6. Whole-browser/installed-PWA process shutdown and fully isolated offline restart across every normal function. Server-unavailable fresh tabs prove only that narrower scope. Closed-PWA timed execution/OS notification delivery is not guaranteed.

## Evidence boundaries

Run baseline Node/Markdown, prototype tests/build, product-shell tests and protected-runtime checks separately. Actual browser storage, actual model generation and physical-device results must name their build and scope. Never clear existing databases, use mock inference as acceptance or mark the whole MVP complete while required gates remain unverified. Historical bwrap/no-adapter results remain historical environment results, not evidence against Bonsai.


- Optional Open d1 Omni 600M now has a pinned isolated local text-decision adapter, with explicit preparation, native WebGPU execution and worker lifecycle. See [DECISION-CONTRACT.md](docs/DECISION-CONTRACT.md). Text graph preparation does not install media encoders, and finite decisions do not authorize writes. Selected prepared D1 now classifies current intent in ordinary Send; bounded read-only routes can proceed directly, while structured and context-dependent retrieval requests retain Bonsai planning. Full context, source validation and approval stay in the harness; phone/full offline acceptance remains open.

## Latest direction: model-independent harness

Unit32 replaces normal Unit31 A/B re-selection with harness-owned current-result identity and typed current/history targets. Continue toward canonical-file/task working targets and model/runtime adapter boundaries. Real-model tests prove integration/load/generation/Stop/offline compatibility and representative flows; do not center development on Bonsai prompt-variant benchmarking. All broader MVP/device gates remain open.

## Opened-file working target

Unit33 implements persisted currentFile ID/version, serialized focus writes, typed file targets and scoped source/Before-After correction dispatch. Keep generated-output selection distinct; source eligibility, protected-system edit limits and whole-record CAS remain. Continue with model-independent runtime adapter extraction, general semantic-operation scope, typed settings/tools edits and remaining media/storage/device gates. Do not treat this increment as the full MVP.
