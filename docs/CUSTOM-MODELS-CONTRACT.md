# User supplied models and local engine adapters

Latest user direction: users may import their own trained models. Local execution remains the default; no provider change or external inference is authorized. Models are data, not executable plugins. Keep the current accepted UI and default Bonsai4B selection.

## Structure

The harness consumes the common text port. An engine catalog describes app-owned adapters and their actual roles/formats; it does not install code. A model record pins engine ID, role, weight bytes/SHA256, file-format metadata and effective context capacity. Runtime code/revision/license come from the app-owned engine, never from a model package. Tokenizer/chat template and media preprocessing are model assets with their own compatibility checks. ONNX and GGUF are containers, not universal interoperability promises.

## Import lifecycle and trust

Add model -> local file selection -> bounded metadata inspection -> engine/asset review -> explicit import and hash verification -> registered selection -> actual device load/test. Inspection is not execution/readiness. Existing built-ins and record histories remain. Registration/selection is canonical data; weights/runtime are separate verified local assets excluded from state brainpacks. Restore cannot manufacture readiness. File/model text never grants network, knowledge writes or arbitrary script execution.

The first custom execution path will reuse the existing pinned WebML Qwen3.5 text worker for structurally eligible GGUFs. It cannot claim all GGUF architectures, quantizations or fine-tunes work. Additional app-owned engines can be added without changing harness/storage authority. Existing D1, Whisper and OCR adapters remain independent role-specific engines; their current fixed graphs/assets do not imply arbitrary custom ONNX support.

## Implementation sequence and acceptance

1. Implement shared engine descriptors and bounded GGUF metadata/tensor-table inspection. Reject malformed/truncated/duplicate/oversized counts; never read a multiGB model wholesale or execute its strings. Test real existing GGUF separately from synthetic parser controls.
2. Add strict declarative custom model records and canonical model-preference integration, preserving old JSON/revisions. Validate backup links without importing asset code or readiness claims.
3. Connect explicit local import, worker manifest registration, prepared-only load and stable inference pins. The worker must independently validate custom metadata/bytes and retain the fixed runtime/fetch deny policy. No custom remote acquisition.
4. Add local model entry/review to existing Add model sheets, same cancellation/storage gates; prove registration/restart/local load/new generation/Stop through actual product. Keep unsupported cases explicit and no disconnected Load buttons.
5. Add further general-purpose engine adapters only with pinned runtime/license/assets, model-specific tokenizer/template/preprocessing support and actual execution evidence. No automatic cloud/PC fallback.

This is an architectural extension in progress. Step1 alone is not a usable custom-model feature. A parser or catalog does not certify numerical compatibility, device capacity or training quality.

## Unit59 foundation evidence

Bounded GGUF v3 inspection and strict declarative local-model records are implemented. The first16MiB prefix may contain initial payload bytes but payload is not interpreted. Known F32 and Prism PTQ1_0 (type143,128elements/28bytes) tensor extents are checked; unknown layouts remain ineligible. Structural eligibility is not numerical compatibility. Hashing streams bytes with bounded task yields, delivered-abort checks and pending-read cancellation/reader cleanup.

Node tests cover malformed/truncated tables and payloads, strict records, exact hashes and both queued-Stop/pending-read cancellation. Existing949549920byte official4B file independently inspected and hashed to manifestSHA256; this is file inspection evidence only. Canonical preferences, local import, worker integration and product UI remain outstanding. Current accepted product build is unchanged.

## Unit60 canonical registry

Preferences/backup now preserve validated customModels with legacy read projection and append-only settings revisions. Registration declarations do not import files or set readiness. Model-proposed patches cannot change registries/libraries. Worker/UI local import and execution remain next; current UI is unchanged. Native PC regression on product36a41e8120bc9759 passed three separate Chrome processes, including offline boot, capture/import/search/direct correction/history and conflict/identical restore. This regression did not execute a custom model.

## Worker registration and local preparation (Unit61)

The shared worker now supports configure({models}) only after init and while unloaded. Each declaration is revalidated and extends a copied built-in manifest; runtime pins, context budget and built-ins cannot come from a custom record. Invalid configuration retains the prior registry. Custom records construct hash-derived GGUF filenames with no download URL and no inferred model license.

Custom prepare requires modelFile and allowNetwork:false. Optional localFiles can contain the fixed runtime.js; otherwise a real cached runtime must independently match its pinned size/hash. Metadata and full model bytes are independently verified before storage. Content-addressed weights can share bytes with an already prepared built-in while retaining separate registration/readiness identity. Load repeats metadata/weight verification and pinned runtime verification, then uses only the existing app-owned Qwen3.5 constructor and local-only fileResponse fetch. No registry field enables network, knowledge writes, arbitrary model code, a larger context window or device compatibility.

All worker cached asset hashing uses the streaming cancellable helper. Fresh copying cancels pending reads on AbortSignal, checks after reads/before close, yields between bounded copy work, aborts incomplete writers and releases readers. Cancellation during valid cached verification never opens a replacement writer or deletes the retained asset. Preparation receipts remain file checks, not generation/offline certifications.

This worker API is not yet connected to the product Add-model UI/hook. scripts/qa/custom-model-worker.mjs explicitly drives the real worker in an isolated native Chrome profile and labels that scope. Importing the official4B file as a custom identity proves that execution path, not an independently trained model's compatibility. Runtime-specific license remains unresolved and runtime is not redistributed.

Unit61 native final evidence: product516da89048c0f9a2, PC Chrome155/Intelgen12lp. Local-only import of the official4B weights under a custom identity, separate offline browser process, verified load, actual hello generation, cancelled separate generation and Unload passed. See TEST-RESULTS.txt and outputs/unit61-worker-final/evidence.json. Canonical registry hydration and Add-model UI were bypassed by explicit QA messages and remain required integration work.

## Product integration (Unit62; supersedes pending UI statements above)

Settings > Text model > Add model > Choose local model opens the native local-file chooser for one GGUF and optional fixed runtime.js. Inspection is cancellable, writes no registration, and presents model label/format/engine/bytes with Execution not tested. Explicit Add uses the worker's independent verification/preparation, records the processing operation, then commits the declaration/library/selection through canonical preferences and waits for storage completion. No implicit download or generation. A failed canonical commit retains review/error; verified orphan asset bytes may remain, but cannot select themselves. Stop and Cancel never manufacture a canonical registration.

## Discoverability correction (Unit234)

The local Qwen3.5 GGUF import is also directly visible in Settings > Models > Text model as `Add local GGUF · Qwen3.5`; it opens the same cancellable inspection/review flow. This removes the requirement to discover a file import hidden behind the model-library add icon. It does not broaden the accepted engine contract. Arbitrary GGUF architectures, general ONNX imports, custom Decision/Speech/OCR models and user-installed runtimes remain unsupported; their fixed UI library entries are not custom-model support.

useBonsai hydrates validated declarations after storage readiness, retains one worker, and reconfigures only while idle/unloaded before operations. Registry changes unload an old model; the effective manifest retains fixed runtime and budget. Stop epochs cross init, unload and configure awaits, preventing a later load/prepare/import/generation command after Stop. Inference identity pins remain authoritative. Added custom entries appear in the existing selector; files Verified and model Loaded remain separate. Missing custom bytes use Import files with one GGUF/optional cached fixed runtime. Custom preparation never fetches assets; the generic Prepare shortcut is not a custom download path.

Actual product21b4c4e1b034da3d at360x780 passed native PC Chrome UI cancellation, explicit inspection/review/Add, files verified, canonical backup, local note capture, browser close/new process offline, persisted selection/asset hydration, automatic local load through normal Send, new grounded answer17 with citation, and final backup. Official4B weights were imported under custom identity; this is not arbitrary/fine-tuned architecture compatibility. Defaults and other records were preserved, connection OFF in all snapshots. See Unit62 in TEST-RESULTS.txt. Additional general text engines, generic custom ONNX/media graphs, phone acceptance and broad model quality remain open.

## Missing local assets (Unit63)

When a persisted custom declaration has no present files, Models shows Local files required and Import files. It never displays the built-in network Prepare shortcut, even when downloads is ON. Built-ins retain explicit preparation controls. Loaded/Verified/local-files-required remain separate. Existing common asset-operation Stop is retained; no duplicate Stop control was added.

Native PC build6f49a36cc2361524 verified declared-only custom settings through the real managed-file editor in a fresh QA profile, import Stop, rejection of an actual matching GGUF when fixedruntime.js is absent, and subsequent offline browser restart retaining missing readiness. This test did not perform a backup restore or inference. Successful local import/execution is separately evidenced in Unit62. Failed/stopped attempts are audit data and cannot manufacture readiness. See scripts/qa/custom-model-missing-assets.mjs and TEST-RESULTS.txt.

## GGUF tensor extent inspection (Unit236)
The bounded inspector additionally validates GGML Q4_0 (type2, 32 values per 18-byte block) and Q6_K (type14, 256 values per 210-byte block). Synthetic truncation and invalid-shape tests pass; the pinned LFM2.5-230M GGUF header/table now has checked extents across F32/Q4_0/Q6_K. This is container integrity evidence only: it does not register LFM2 as a custom engine or prove inference. The product custom-import eligibility remains Qwen3.5-only until a separate runtime registration path passes normal product-flow tests.

## LFM2 custom adapter and product registration (Unit237–242)

The custom registry now accepts a second explicit GGUF contract: GGUF v3, `lfm2`, GPT-2 tokenizer metadata, a chat template, checked tensor extents, and only F32/Q4_0/Q6_K tensors. This record routes to the app-owned, locally packaged Wllama CPU-count runtime. The model cannot provide runtime code, URLs, context budgets or license claims. Local weights are content-addressed in OPFS, imported only from a user-selected file, and rehashed before write, after write and before load. The built-in Bonsai4B selection and Qwen3.5 registration path remain unchanged.

Inspection, preparation receipts, first-time preparation byte estimates, worker registration and model selection now carry the custom LFM2 record through the canonical settings flow. Settings presents a generic `Add local GGUF` action; review shows the detected compatible family and clearly says `Execution not tested`.

Verification: `npm test` 93/93, `npm run test:prototype` 409/409, `npm run test:app` 2/2, `npm run check` and production build `248ba85c61b1fa6e/117` pass. A fresh native PC Chrome profile imported the official LFM2.5-230M-QAD Q4_0 file through the product picker, registered it and loaded it through the normal model settings controls. This is one compatible user-selected model sample, not arbitrary GGUF support or evidence for custom-trained models. A subsequent natural-language Send using that loaded model did not produce a completed chat turn within four minutes. Generation through the full product harness remains unverified and is an open blocker; successful load must not be interpreted as successful inference. No phone or iPhone claim.