# Model roles and local media pipeline

2026-10-21: ordinary Send now connects bounded sampled video frames through the existing prepared Vision model, with separate optional audio provenance. See [sampled video contract](VIDEO-VISION-CONTRACT.md). Earlier video-frame pending statements below describe the prior boundary; physical-device, full-offline, broad accuracy and whole-video understanding are still unverified.

## Decision

### Preferred fresh-install text model

Use Liquid AI LFM3-1.7B QAD Q4_0 as the fresh-install text default and retain Bonsai as a selectable alternative. Liquid AI's [model card comparison](https://huggingface.co/LiquidAI/LFM3-1.7B) reports LFM3 above Gemma 4 E4B on BF16 agent/tool metrics including LiveClaw (45.60 vs 20.36), WebArena-Verified (38.42 vs 17.06) and BFCL V4 (71.39 vs 48.25). This is strong reason to prioritize LFM3 for BabelShelf's agent workload, but the task scores are BF16 and do not establish Q4_0 application quality. The same card's edge comparison reports Q4_0 llama.cpp runs at 32K context, including iPhone 17 Pro; it is useful evidence for the small-model edge case, not an iPhone Air or browser-WebGPU guarantee. The [official GGUF card](https://huggingface.co/LiquidAI/LFM3-1.7B-GGUF) identifies QAD Q4_0 as distilled to recover Q4_0 accuracy and lists Q8_0 at 1.85 GB versus 1.05 GB for Q4_0. The app's bounded GGUF inspection now accepts Q8_0 tensor extents for the LFM3 route; real Q8 model load/generation and a same-task Q4/Q8 quality comparison have not been run. The publisher cautions against relying on the 1.7B model for complex multi-step reasoning, so keep source checks, tool schemas, harness validation and write approval deterministic. Do not rewrite existing model selections or stored settings.

LFM3 now has a pinned manifest, importer eligibility, isolated WebGPU worker/runtime route and optional runtime-asset role. Its fresh-install context is set to 8,192 tokens; this replaces the arbitrary 2,048-token application default and feeds the same context-aware evidence, compaction and output budgeting path. This is a product configuration, not a measured iPhone memory guarantee. One PC installed-PWA run passed preparation, offline cold restart, a grounded LFM3 answer and exact source preview. Tool/structured-output behavior, cancellation and same-runtime retry, reviewed answer-save, sustained performance and phone fit still need their own checks. Fresh settings select LFM3; existing stored settings are preserved. The pinned LFM3 context selector now exposes 8K through 256K in powers of two while keeping 8K as the default. This makes the model card capacity selectable without silently lowering it for phone users. Larger contexts may fail when the browser/GPU lacks memory; no high-context WebGPU fit or performance is claimed. QAD Q4_0 is the current default because it is explicitly distilled for Q4_0 and is the pinned product route; Q8_0 is a reasonable higher-precision candidate, but should be promoted only after checking runtime support, memory headroom and whether its answer quality materially improves representative tasks.

Settings > Models distinguishes **Add custom GGUF text model** (register another compatible model) from **Supply files for selected [model]** (supply the exact assets for the current selection without creating a model). A compatible text GGUF carries tokenizer and chat-template metadata inside the GGUF; ONNX text packages, D1 decisions and Whisper speech require their matching configuration/tokenizer files. The local file picker accepts ONNX data shards as well as the graph and JSON files. Supplying files verifies identity but does not prove inference on this device. The existing custom adapters accept Qwen3.5, LFM2 and LFM3 GGUF text, D1 text ONNX decisions, and Whisper ONNX speech. Arbitrary OCR, vision, video-frame and other architectures still need an app-owned execution adapter before import can be enabled.

The built-in LFM2.5-VL Vision role now also offers **Import files for selected vision model**. This accepts only the 13 names, exact byte lengths and SHA-256 hashes in `vision-manifest.json`; it does not register an arbitrary custom vision architecture. A user may supply part of the package and retry with the missing files. Complete readiness requires all 13 verified assets. Local import never enables network access; the browser rechecks cached bytes before returning them to the Vision runtime. Download and import stream hashes alongside cache writes to avoid holding the 319 MB package in one JavaScript buffer. A failed digest removes that cache entry, and an interrupted attempt is not marked ready. This is asset integrity, not proof of successful image inference. The generic Vision download path reports the failing file and HTTP status, which matters when a browser intermediary fails before model execution.

Settings > Media reading lists PDF, image, audio and video as file types. Choosing one stages the original in the same Input composer as the attachment button; it does not silently prepare a model or claim that the content was read. PDF text layers are read by bundled PDF.js without a separate model; scanned PDF pages and images need prepared OCR; image questions need a separate prepared Vision model; audio and the audio track of video can use prepared speech transcription; sampled video frames can use that same prepared Vision model. A verified model asset is distinct from successful content extraction, inference, and phone acceptance.

## Large Bonsai selection

Model selection is driven by the user's task and preference, not a model-size ceiling. Keep connected candidates selectable when their adapter supports them; do not silently replace a selected model or omit it only because its files are large. Compare language/task quality, context support, verified runtime compatibility and observed device behavior. Show pinned transfer size as storage information, separate from working-memory estimates and execution evidence.

Prepared model assets are retained in origin-local storage and reused across app restarts when the browser keeps them. That does not mean the model stays loaded in RAM/GPU memory: a runtime can release it, a browser can evict origin storage, and switching models can require another load. Preparation is explicit and verifies pinned files; it does not guarantee model fit or prevent later eviction. Device checks are advisory, never a size-based prohibition, silent downgrade, or model substitution. Downloads & updates must be enabled for built-in acquisition; imported custom files remain local-only.

The standard text catalog contains app-owned choices including Bonsai 2 2B, 4B and 9B alongside LFM2.5 and ONNX choices. The 9B option is text-only and unverified on iPhone. PC prose generation produced corrupted punctuation and did not pass its quality guard, so it remains an optional candidate with that observed limitation visible; file size itself is not the reason to exclude it from a preset or selection.

Fresh settings register LFM3 and Bonsai 2 2B directly in the Text library, with LFM3 selected. Other connected choices, including Bonsai 2 4B/9B and LFM2.5, remain explicitly addable/selectable through their app-owned routes and presets. The default library is written only for new settings and explicit Reset defaults; existing settings libraries, selections, assets, custom registrations and history are not migrated or overwritten.

Initial preparation follows the selected set. A text-only choice budgets no speech/OCR/Vision files. Selecting a broader set makes its supported reader roles appear in the same preparation review; Vision uses its own pinned 319 MB asset package. Neither selection nor verified bytes prove that Vision inference or a 9B text model will run well on a phone.

The Text settings **Check device** action is an optional read-only preflight. It compares the selected model file size with the browser's reported available storage estimate, and probes for a WebGPU adapter only when the selected app-owned engine needs WebGPU. CPU/WASM text engines skip that probe. It does not download files, prepare or load a model, change the selection, request persistent storage, or measure physical free disk, RAM, GPU memory, throughput or generation quality. Its result is advisory: the user can free storage, retry, choose a different model, or continue where the app allows; the app never silently substitutes a smaller model. A positive result permits only an attempt at explicit preparation and real execution.

The Add model list only offers models with an app-owned preparation path. D1 3B remains a disconnected placeholder in the persisted schema for older settings and is not offered as a new addition. Whisper tiny and base both have connected, separately pinned preparation paths. Existing user selections and histories are not silently rewritten.

Prism ML's earlier [Ternary Bonsai 8B](https://huggingface.co/prism-ml/Ternary-Bonsai-8B-gguf) is Qwen3-based. Its deprecated `Q2_0.gguf` and current `Q2_0_g64.gguf` both use GGML type 42 but have different group sizes; `PQ2_0.gguf` uses type 142. [Prism's current matrix](https://github.com/PrismML-Eng/Bonsai-demo/blob/main/MODEL-FORMATS.md) lists the group-64 file for recent upstream llama.cpp and PQ2_0 for the Prism fork. [Bonsai 2 9B](https://huggingface.co/prism-ml/Ternary-Bonsai-2-9B-gguf) is Qwen3.5-based with a 2.00 GB PTQ1_0 language pack and a separate optional vision projector. The native compatibility update does not make the older 8B runnable in the app's WebML Qwen3.5 worker or pinned wllama LFM2 adapter. A browser engine must prove the correct Qwen3 model structure, group-size decoding, tokenizer/chat template and complete execution. Adding 8B as a preset also requires measured memory and cold offline behavior, not a GGUF filename match.

[WebKit reports WebGPU in Safari 26 on iOS](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/), so API availability alone is no longer the deciding objection on an updated iPhone. The older 8B still lacks a verified Qwen3 ternary browser adapter in this app. Its current group-64 file is 2.31 GB before runtime, KV cache and other working memory; the 2.18 GB PQ2_0 file also requires a compatible kernel. Neither size predicts phone fit. The 9B has an app-owned Qwen3.5/PTQ1_0 path but remains a candidate until actual target-phone execution passes. Do not equate a positive WebGPU probe or successful native llama.cpp load with mobile PWA execution.

Do not add a generic `Media model` role. It hides distinct capabilities and can make a model label look like support for every media type. Register models against the work they can actually perform. A media task may compose several independently verified local capabilities.

| Role/capability | Purpose | MVP policy |
| --- | --- | --- |
| Text generation | Answer, summarize, draft and transform stored knowledge | Required. One selected local model; preserve a replaceable adapter boundary. |
| Decision/routing | Choose among an allowlisted set of reads, searches and writes; emit validated structured arguments | Optional. Keep authority in the deterministic harness. A decision model can propose a tool call, never grant permissions or write/delete by itself. |
| Speech-to-text | Transcribe an audio range into reviewable text | Optional. Keep original audio and timestamp/source links. |
| OCR | Extract visible characters and regions from images or document pages | Optional and distinct from visual understanding. OCR results must not imply scene/object understanding. |
| Vision-language | Describe or answer questions about an image; provide grounded observations | Implemented as an optional local model. Actual device inference and offline cold restart remain unverified. |
| Text-to-speech | Read a generated or stored response aloud | Useful accessibility extension, but not required for knowledge capture/search MVP. Separate from speech-to-text. |
| Embeddings / reranking | Improve semantic retrieval and result ordering | Later optional search enhancement. Keep lexical multilingual search working without it; rebuilding or changing an index must be explicit and recoverable. |

There is no separate translation, summarization, calculator, or “video LLM” requirement for the first release. The selected text model can translate/summarize when capable; deterministic local tools should handle arithmetic and date calculations exactly. A future specialized model is justified by a measured capability gap, not by a broad role name.

## Media composition

- **Image:** retain the exact original; OCR may produce text and regions, while a vision-language model may produce a separately typed, reviewable description. Do not conflate the two outputs.
- **Audio:** retain the exact original; speech-to-text produces a transcript with model revision and time ranges. Text-to-speech is an output path and is not evidence about the source audio.
- **Video:** retain the exact original; run audio transcription when prepared, then extract a bounded set of sampled frames and pass those still images through the same vision-language capability. Record the inspected time ranges and frame timestamps. Partial sampling must be stated as partial; playback or audio-only transcription is not video understanding.
- **PDF/document:** extract a text layer where available; scanned pages need OCR, and image-page understanding needs the vision-language capability. Page and region references remain distinct.

Each derived result records the original asset ID and revision, the exact model/runtime revision, inspected ranges, status and output revision. A missing/unprepared processor blocks claims that depend on it; it does not trigger a network fallback. Search and answer citations point back to original bytes and exact text, page, region or time ranges.

## Context injection and window limits

Context injection is a harness responsibility shared across model roles; models do not fetch their own memory or decide which tools/permissions to receive. The harness builds a per-call context from explicitly scoped inputs, counts it with the selected engine's tokenizer, and reserves the output allowance before generation. It must reject an oversized current request or omit lower-priority optional context with a visible, auditable reason; it must never silently truncate the user's latest request or attachment evidence. Every model adapter declares its context limit and output reserve. A context-limit failure is recoverable by narrowing the request or choosing fewer sources.

Use this order of precedence when building an inference call:

1. Fixed role policy and output contract, supplied by the trusted harness.
2. The exact current user request and its explicitly selected input scope.
3. Verified, relevant evidence with original IDs/revisions/ranges.
4. Recent dialogue and a bounded compaction summary, only when relevant to the request.
5. Optional user-authored role/harness preferences, versioned and clearly separated from fixed policy.

Memory excerpts, old dialogue, compaction summaries, attachments, extracted OCR/transcripts, model outputs and user-editable harness text are data, not new system instructions. They cannot grant tool/network access or authorize edits/deletes. Fixed policy, tool capability contracts and current request occupy distinct message fields; never concatenate untrusted text into the trusted system policy. A model may propose a finite action, but the deterministic harness validates scope, arguments, permission, current source revisions and any required review before execution.

The text dialogue already performs tokenizer-counted context budgeting, history compaction, bounded recalled excerpts and separately validated source evidence (`conversation.ts`, `grounded-answer.ts`). The Vision MVP currently injects only its fixed image-reading policy, the current question and one image; it does not yet inject the ongoing dialogue or retrieved memory. Keep that as an explicit scoped limitation until Vision has an equivalent processor-tokenizer budget, provenance-preserving context selection and prompt-injection boundary. Do not copy the entire chat or memory into an image request by default. Speech, OCR and future media models should use the same contract with modality-specific budgets and exact source ranges.

Context is rebuilt for each inference, not treated as canonical knowledge. Compaction may summarize active working context but must retain the original dialogue and sources; summaries are lossy and never replace source records. Saved generated output remains an explicitly reviewed new note, with lineage to the exact model, prompt, injected evidence references and source asset.

## Candidate for the missing capability

`onnx-community/LFM2.5-VL-450M-ONNX` is now registered as an optional local Vision-language model. The app pins revision `24e63007ff1aaafbde27c89eb01a0513f4f61482`, Transformers.js `4.3.0`, and each required processor/tokenizer/ONNX asset by byte length and SHA-256 in `design/prototype/src/vision-manifest.json`. Model data totals about 319 MB before runtime cache overhead. Assets are downloaded only by explicit Prepare, verified before caching, and served from a private local cache; a missing asset returns 404 instead of allowing Transformers.js network fallback. The app bundles the vision worker but not the model weights. Image questions use the selected image locally and return an ephemeral answer labeled with its model revision. The user can explicitly save the reviewed result as a new Markdown note; this stores the exact original image if it was not already saved, adds a strict `mediaSource` link, and records the prompt/model/runtime in immutable derivation metadata. The result becomes editable as a normal note without regenerating or overwriting prior knowledge. The UI exposes this as optional and does not claim video understanding from it.

The model license and runtime/package licenses are separate. The model card identifies the LFM Open License (`lfm1.0`), not Apache-2.0. The locked npm metadata declares Transformers.js 4.3.0 as Apache-2.0 and ONNX Runtime Web as MIT; include and review the applicable notices for redistributed app bundles. These component licenses do not change the model license. Missing assets are never silently downloaded during ordinary use.

Official references:

- [LFM2.5-VL-450M ONNX model card](https://huggingface.co/onnx-community/LFM2.5-VL-450M-ONNX)
- [Liquid AI LFM2.5-VL documentation](https://docs.liquid.ai/lfm/models/lfm25-vl-450m)
- [Transformers.js documentation](https://huggingface.co/docs/transformers.js/index)
- [Transformers.js releases](https://github.com/huggingface/transformers.js/releases)

Registration and asset integrity are implemented. Remaining gates are to validate real WebGPU inference in a supported browser, inspect output quality and cancellation, verify offline cold reload, and measure peak memory/latency on target phones. A small parameter count does not establish low peak memory or acceptable latency on a phone. Runtime dependency license obligations still need a separate package-level review; the model license does not cover the runtime.

## Model sets

Sets remain reviewed preference presets, not executable workflows or device-fit claims. The text/speech/OCR/decision sets must not be relabeled “full media.” **Text + Vision** selects image understanding alone alongside Text; **Text + image + audio** selects Text, Vision, OCR and Speech-to-text, with video frames explicitly excluded. Applying a set only changes role selections, preserves other registrations and settings, and never fetches or prepares assets. Selecting Vision does not claim that model files are prepared or that the device supports WebGPU.

The standard installation should be modular: text is required; decision, speech, OCR and vision are independently selectable/prepareable according to the user's needs and storage. Vision is a strong standard catalog candidate but should not be forced into first-run preparation. TTS and embeddings remain optional extensions rather than blockers for the first local knowledge workflow.

## Completion gates

1. Adapter, immutable model revision and local asset verification are implemented; runtime package licensing still requires separate review.
2. Explicit preparation and missing-asset no-network behavior have focused tests; a full browser cold-reload check remains outstanding.
3. Worker execution path, WebGPU check and cancellation are implemented; real model output has not yet been verified in a WebGPU browser.
4. Derived output remains tied to its immutable original and model revision, supports review/correction history, and yields exact source references.
5. Video sampling has explicit limits and per-frame provenance; no result implies uninspected intervals were analyzed.
6. Build and 454 prototype tests pass. Browser WebGPU output, offline cold-reload, target-phone performance and device acceptance remain unverified.

2026-10-20: Whisper base is now connected through the shared built-in speech identity/pins, preparation and inference path. It is no longer a disconnected catalog placeholder. D1 3B remains disconnected. Prepared single-image Vision now also participates in ordinary Send through the existing typed input-reading transaction, retaining generated-observation coverage rather than claiming extracted facts. See INPUT-READINGS.md and TEST-RESULTS.txt for exact evidence scope.

## Vision inference lifetime (2026-10-20)

The Vision client treats describe as one operation, rather than an indefinitely loaded model session. On a successful or failed final response it detaches and terminates the image worker before resolving/rejecting the caller. The text-answer continuation can then begin without an idle image model intentionally retained by this client. Preparation and readiness remain storage facts; no model files, selection, original or observation record are deleted. Another explicit image request creates a fresh worker and loads only prepared local assets. Progress, Stop, errors and late messages remain isolated by worker identity and request sequence; there is no automatic replay.

This bounds the image worker lifetime after inference. It does not establish an exact browser/driver memory reclamation time, prevent every possible cross-role overlap before image inference, or prove phone peak-memory limits. Those are separate resource-coordination/device gates.

## Vision entry releases idle Text/Decision owners (2026-10-20)

The same Vision client entry serves manual image questions and ordinary Input
reading. Before describe dispatch, the app refuses active Text/Decision inference,
then awaits unload of each loaded idle owner. It never loads an unselected model
or changes selected/prepared model records. The client reserves its request while
this preflight runs. Stop invalidates that reservation; a delayed release cannot
start image inference after cancellation. Release failure rejects the request and
requires a later explicit action; no fallback or automatic replay is introduced.
Manual image reading also guards other active app operations and repeated entry.

After Vision returns, its operation-scoped worker terminates before the existing
text-answer flow can explicitly reload its selected model. This is an ordered
ownership boundary for Text/Decision -> Vision -> Text, not a universal RAM budget
or an OS/driver memory reclamation guarantee. Speech/OCR worker lifetime, cross-tab
GPU use, and physical-phone memory pressure remain separate work.

LFM3 browser adapter note (model cards checked 2026-10-29): Liquid's LFM3-VL ONNX file table pairs `decoder_q4f16` with `vision_encoder_fp16`, but its browser-specific instructions instead specify `decoder_q4f16` with the q4 bundle's float32 `vision_encoder_q8` and prefill chunks of at most 1,024 tokens. Treat this table/browser distinction as unresolved until the exact pinned files and graph types are verified; do not assume either combination works. The Audio card likewise specifies the WebGPU import, q4f16 decoder, float32 q4 side graphs, and at-most-1,024-token prefill. Audio also needs 16 kHz log-mel preprocessing and, for synthesized audio, separate depth/codec decoding. These are integration requirements, not implemented or measured capabilities. Sources: https://huggingface.co/LiquidAI/LFM3-VL-2B-ONNX and https://huggingface.co/LiquidAI/LFM3-Audio-2B-ONNX

## LFM3 multimodal candidates (reviewed 2026-10-30)

The official ONNX cards now expose three concrete browser candidates, but none is connected to BabelShelf's Vision/Speech adapters. LFM3-VL-2B provides image and video features; its WebGPU recipe names `onnxruntime-web/webgpu`, a `decoder_q4f16` plus the q4 bundle's `vision_encoder_q8`, and prefill chunks up to 1,024 tokens. The listed q4f16 package is 1.69 GB. LFM3-Audio-2B provides audio input and speech output; its q4f16 WebGPU package is 2.09 GB and requires 16 kHz log-mel preprocessing, a depth decoder and codec/audio reconstruction in addition to the text decoder. LFM3-Omni-2B combines image/video/audio input and speech output; its q4f16 WebGPU package is 2.47 GB, with separate vision, audio, depth and codec graphs. All three cards specify the WebGPU-specific ONNX Runtime entry point; the generic ONNX Runtime Web import is insufficient. These are publisher package figures and integration instructions, not app asset manifests, measured working memory, or proof of browser execution. Sources: [VL ONNX](https://huggingface.co/LiquidAI/LFM3-VL-2B-ONNX), [Audio ONNX](https://huggingface.co/LiquidAI/LFM3-Audio-2B-ONNX), [Omni ONNX](https://huggingface.co/LiquidAI/LFM3-Omni-2B-ONNX).

Decision: keep LFM3-1.7B Q4 as the current fresh-install text choice and leave Vision, OCR and Speech as independently prepared capabilities. Do not add the 2B variants to standard sets or claim video/audio support from their cards alone. The next worthwhile model evaluation is an optional LFM3-Omni adapter spike because one package advertises the broadest input/output set; compare it against the current modular pipeline for total prepared bytes, peak memory, first-result latency, citations to original ranges, cancellation and offline cold restart. If that adapter cannot meet those contracts, evaluate VL and Audio separately. Keep selection, provenance and preparation behind the existing role interfaces; do not replace the working text or media pipeline until a real browser run passes the same task suite. This ordering is an engineering recommendation, not a measured performance conclusion.
