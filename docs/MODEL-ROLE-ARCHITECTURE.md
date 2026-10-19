# Model roles and local media pipeline

## Decision

The Settings UI distinguishes **Add model** (register a compatible model for a role) from **Import selected model assets** (supply the exact pinned files for the model already selected). A custom text GGUF carries its tokenizer metadata in the GGUF; the D1 and Whisper adapters require their separate tokenizer/configuration files. Importing bytes verifies their identity but does not prove generation on the current device. The existing custom adapters accept Qwen3.5/LFM2 GGUF text, D1 text ONNX decisions, and Whisper ONNX speech; arbitrary OCR, vision, video-frame, and other architectures still need an app-owned execution adapter before import can be enabled.

Media readiness is displayed by operation: PDF text layers are read by bundled PDF.js; scanned PDF pages and images need prepared OCR; image questions need a separate prepared Vision model; video audio can use prepared speech transcription. Video frames remain unsupported. A verified model asset is distinct from successful content extraction, inference, and phone acceptance.

## Large Bonsai selection

The standard text catalog contains at least three distinct downloadable app-owned choices (Bonsai 2 2B, 4B, 9B), alongside smaller LFM2.5 and ONNX choices. Selection alone does not download or load a model; preparation is explicit, checks pinned bytes, and requires Downloads & updates to be enabled. The chooser shows each pinned text-model file size before selection. This is a storage figure, not peak RAM or device compatibility. The 9B option remains text-only and unverified on iPhone; do not make it the phone default on the strength of its 2.00 GB file size.

Prism ML's earlier [Ternary Bonsai 8B](https://huggingface.co/prism-ml/Ternary-Bonsai-8B-gguf) is Qwen3-based Q2_0 at about 2.18 GB and calls for the Prism `llama.cpp` fork. [Bonsai 2 9B](https://huggingface.co/prism-ml/Ternary-Bonsai-2-9B-gguf) is Qwen3.5-based with a 2.00 GB PTQ1_0 language pack and a separate optional vision projector. They are different model structures and runtime contracts. The current pinned WebML Community path lists the 9B text pack; that does not prove mobile load, generation, cancellation, or cold offline restart. Adding the older 8B as a preset would require its own validated browser engine and memory evidence, rather than passing its GGUF to the current WebML worker.

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

Sets remain reviewed preference presets, not executable workflows or device-fit claims. The present text/speech/OCR/decision sets must not be relabeled “full media.” A **Text + Vision** set may select the Vision model; **Local media** combines Text, Vision, OCR and Speech-to-text. Applying a set only changes role selections, preserves other registrations and settings, and never fetches or prepares assets. Selecting Vision does not claim that model files are prepared or that the device supports WebGPU.

The standard installation should be modular: text is required; decision, speech, OCR and vision are independently selectable/prepareable according to the user's needs and storage. Vision is a strong standard catalog candidate but should not be forced into first-run preparation. TTS and embeddings remain optional extensions rather than blockers for the first local knowledge workflow.

## Completion gates

1. Adapter, immutable model revision and local asset verification are implemented; runtime package licensing still requires separate review.
2. Explicit preparation and missing-asset no-network behavior have focused tests; a full browser cold-reload check remains outstanding.
3. Worker execution path, WebGPU check and cancellation are implemented; real model output has not yet been verified in a WebGPU browser.
4. Derived output remains tied to its immutable original and model revision, supports review/correction history, and yields exact source references.
5. Video sampling has explicit limits and per-frame provenance; no result implies uninspected intervals were analyzed.
6. Build and 454 prototype tests pass. Browser WebGPU output, offline cold-reload, target-phone performance and device acceptance remain unverified.
