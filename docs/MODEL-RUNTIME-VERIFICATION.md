# Bonsai and production entry verification — 2026-10-17 JST

These are Windows PC / Codex in-app Chromium results, not Android or iPhone results. The full goal remains active.

## Reproduce the production entry

Run `npm run build:app`, then `node scripts/serve-product.mjs 4180` from the repository. Open http://127.0.0.1:4180/. The static server does not run inference. The protected phone preview remains at `design/prototype/`, independently buildable. `product/` supplies native browser input/scroll/sheet adapters and shares the accepted app UI. No protected runtime files were changed.

Downloads reset OFF at boot via a retained connection-record revision. Explicit Prepare fetches pinned upstream model/runtime files into OPFS and verifies capacity and SHA-256. Inference denies ordinary fetch and reads a local File through Range responses. No model weights or third-party inference runtime are redistributed in Git.

App shell assets are hash-verified on installation. Missing ordinary resources return503 rather than fetching replacements. External requests are restricted to the exact manifest asset URLs used by explicit preparation. Connection > Downloads ON > Check for updates > Apply update prepares/verifies a new cache. Reopen to use it; a live draft is not automatically discarded. Existing IDB/OPFS remains intact.

## Runtime inspection and actual model

Runtime revision621e20782f208660f4f58283c2ce58430020f243:2208435 bytes; SHA-25600c1a72a962a84fee17000a6b1d18b24d75033e56d59996fc504b7c57cfc6488 matched. The bundle was inspected outside Git. It includes PRISM_PTQ1_0(143), PRISM_PQ2_0(142), Q2_0, BlockHadamard/sign processing, GGUF tokenizer/template handling and the Qwen3_5 conditional-generation implementation. Code presence does not establish numerical equivalence across all formats. Only the manifest's 4B PTQ1_0 weights were loaded/generated in this run. Runtime-specific redistribution licensing remains unresolved; model Apache-2.0 does not establish it.

Two real integration bugs were fixed: GPUAdapterInfo was not structured-cloneable, obscuring successful adapter acquisition; Vite rejected an out-of-graph worker URL. Plain GPU fields and an app-owned worker entry resolve these. Dead workers reject later calls instead of leaving promises pending.

4B Prepare -> Verified -> local hash check -> streaming weights -> kernel warmup -> Loaded succeeded at4180. Actual classification and a multilingual summary of the imported QA1040 original succeeded with exact citation validation. Saving the existing output created QA1054-generated-summary.md without regeneration.

## Offline and fresh generation evidence

Production build16da582c384327bd, script index-CotSl4YB.js: HTTP server stopped, app tab closed, new tab opened, downloads OFF. The shell started and OPFS4B rehashed/reloaded successfully. A new original containing a random verification code was created after restart. `Answer: What is the verification code in QA1057?` produced PINE-P0PRW9MQ with a valid source; it matched the new original and was saved as QA1057-offline-answer.md. This was actual inference, not a canned response or mock.

Actual Stop reached Stopped and did not save partial JSON; Unload reached Verified/Unloaded. Stop latency has not been quantitatively bounded; cancellation is cooperative with GPU work. The original partial-JSON parse error after abort was fixed in useBonsai.

An older production shell8b05200ed00efedf at4182 also ran with its server stopped: new-tab startup/search, new capture, Rebuild index, local brainpack export/digest verification and confirmed local restore0conflicts passed.

Updated build745c77f0897f7b7a (index-BzK2QyJn.js) removes preview-only status-bar strips and adds explicit update controls. A development-only Network bypass plus Page.reload bootstrapped the first update-capable page; then its normal Check/Apply update flow activated the verified new shell without clearing storage. QA1057-offline-answer remained readable after normal reload. Shared inference worker hash CP1YQK8C was unchanged by this UI update.

Follow-up build54e2cd22152e893d (index-BjzwrC05.js) fixes native navigation positioning as well. The normal Check/Apply/reopen flow was exercised again without a development bypass. Measured primary button top14/height72 and breadcrumb top126 do not overlap; the saved generated answer is intact. Inference worker hash remains unchanged.

These results prove distribution-server-unavailable new-tab startup with local resources and inference fetch denial. They do not prove OS-level airplane mode, a full browser-process restart, installed iPhone PWA relaunch, GPU memory/thermal behavior or every required function.

## Remaining limitations

Planner quality is limited: one factual Japanese question was classified as search, and another rewritten query missed its source. Prompt wording and empty-result fallback were improved. Explicit Answer:/回答：/Summarize:/要約： routes bypass classification while still using actual generation. Structural citation validation does not prove semantic correctness.

4B succeeded, so2B fallback was not required for this PC flow. Canonical foreground tasks/events/run history are now connected (see SCHEDULE-CONTRACT.md); actual successful scheduled generation remains unverified. Decision/ASR/custom architecture support, bounded model corrections/undo/receipts, persistent media/extraction, full-state backups and physical-device/full-feature offline acceptance remain pending. Do not mark the MVP complete.

## Continuous dialogue and compaction follow-up

Final build03e76ab7364f030b, script index-C-fXe6hI.js, inference worker CP1YQK8C unchanged. Used the normal Check for updates / Apply update / reopen flow without clearing IndexedDB or OPFS. Stopped the4180 HTTP server, closed the QA tab, and opened a fresh tab. Downloads remained OFF. The cached app, persisted original conversation and verified OPFS4B loaded; a new first-message question visibly returned `LILAC-7319`. The original user statement existed only in the local dialogue before this test, not as a canonical knowledge note. Earlier real compaction had run and the original turns remained intact.

This required an explicit read-only original-turn route: actual4B compaction had incorrectly attributed a separate saved-note code to the user, and bounded lexical recall omitted the original value. Those failed turns were retained. After reading turn0 exactly, actual4B returned the correct value but added an invented S1 citation; citation validation rejected it. The final build uses answer-only JSON for dialogue and retains strict source validation for note answers. The correct value then appeared in the UI, with no fabricated source. Temporary diagnostic prompt/output logging was removed before this final build.

A subsequent request to split the preceding code into two lines returned the same hyphenated code instead. Original recall success does not establish general instruction-following or lossless compaction. This is an observed4B quality limitation, not a passing formatting test. Full browser-process restart, OS airplane mode, installed mobile-PWA restart and physical-device behavior remain unverified.

The next natural-language request, `その返答をメモに保存して。`, opened the new-file review with the exact preceding answer `LILAC-7319`. Saving it as Inbox/QA-conversation-exact-answer.md created v1 without regenerating the body. With the server still stopped, reload retained the dialogue/save receipt, and Memory / Inbox reopened the same exact v1 text. No console errors were observed on the final reloaded tab. The local4180 server was restarted after testing. Screenshots are retained in the task workspace outputs/conversation-context-verified.png and outputs/conversation-exact-save.png, outside Git.
