# Local inference optimization — 2026-10-21 JST

## Delivered architecture

The product keeps its model-independent TextEngineRouter, exact tokenizer admission, prepared-file ownership and reviewed harness writes. The current WebML Qwen3.5 WebGPU runtime is still the latest upstream revision observed on this date: `621e20782f208660f4f58283c2ce58430020f243`, SHA256 `00c1a72a962a84fee17000a6b1d18b24d75033e56d59996fc504b7c57cfc6488`. Its adapter selects supported GPU features/limits; the app does not call Metal/D3D12/Vulkan directly. LFM/ONNX CPU paths and reader ownership remain separate. No default model, context limit, sampling policy, source validation, review, network permission or storage history changed.

The measured optimization is in the repeated file-verification/load path:

1. `dist/streaming-sha256.js` supplies an application-owned accelerator with three known-answer self-tests and independent per-operation state. `src/fast-hash.ts` registers pinned MIT hash-wasm4.12.0 in the product window and Bonsai worker. Its WASM is embedded in the verified app bundle, with no runtime fetch. Unsupported/broken initialization falls back to the existing SHA256 implementation before hashing. Update/digest failures do not produce a verified result. Full model/runtime hashes are still required; readiness metadata never replaces hashing.
2. `hashLocalModel` remains streaming and processes bounded64KiB parts. Task yields are time/byte bounded (check after1MiB, yield by4MiB or8ms since the previous yield); final cancellation is checked before returning a digest. This reduces unnecessary task scheduling on fast hashes while preserving queued Stop, pending-reader cancellation and exact byte counts. Preparation/copy hashing uses the same verified backend.
3. Repeated load of an already resident healthy model with the same model revision, runtime revision and context reuses its existing session. Changed identity, failed workers, unloaded models and engine switches follow the existing load/disposal path. This preserves the runtime's ordinary in-memory token-ledger reuse; it introduces no persisted prefix cache or source authority.
4. Worker load results now separate verification, module import, runtime load and total load durations. Generation results expose exact runtime completion-token counts, runtime-reported TTFT/decode duration/decode rate, visible-text TTFT, count time, overall generation time and runtime memory before/after. Missing values remain null. Text chunks are never treated as tokens. Overall tokens/second includes prefill and is named separately from runtime decode rate. Ordinary harness projection still excludes these internal fields from model context and product prose.
5. Diagnostic generation accepts explicit pipeline depths1/4 for a bounded comparison. The default remains1. The pinned runtime accepts `decode_pipeline_depth`; enabling higher depth globally needs output/Stop/memory/device measurements. No calibration runs automatically during normal use.

## Actual desktop measurements

Evidence JSON: `research/evaluations/inference-optimization-2026-10-21/`.

Windows11 build26200, i7-1250U, Node24.6.0 x64. These are CPU file-verification measurements, with no browser or token generation. The real fixed-revision Bonsai9B PTQ1_0 file is1,997,486,976bytes; model revision`5b2abb02362efbed46bbe204014b02837778b2c2`, SHA256`3561df7ac7d26a71ffa991ac2db740b10841c3a350aa2676ccd3ff5d428b4e8b`. Both runs match that hash.

| Measurement | Previous verifier | Accelerated streaming verifier |
|---|---:|---:|
| Wall time |26,936.56ms|18,193.49ms|
| Throughput |70.72MiB/s|104.71MiB/s|
| Process user CPU |13,875ms|8,844ms|
| Peak sampled process RSS |61.38MiB|109.35MiB|

Observed wall time reduced32.46% (1.48x throughput), process user CPU36.26%. This is one before/after pair under uncontrolled OS file caching and memory pressure. The change includes WASM and scheduling. It does not isolate their contributions, establish a statistical distribution, lower total model-load time by32%, or measure generation speed, energy or iPhone performance. Peak Node RSS increased; it is process/JIT/package memory, not GPU allocation, and must not be described as an app/phone memory saving. Product bundle growth is about19KiB per main/Bonsai worker before compression plus the MIT notice; browser memory cost remains unmeasured.

## Actual 9B packing compatibility checks

The [Prism model card](https://huggingface.co/prism-ml/Ternary-Bonsai-2-9B-gguf) identifies the family as Qwen3.5 with a matching Hadamard activation transform. A smaller file alone is not a performance ranking. The [Prism format definitions at the inspected source revision](https://github.com/PrismML-Eng/llama.cpp/blob/73bfe6cc485554822f80c473a3c0c4f25e80f41b/ggml/src/ggml-common.h#L182) distinguish the three layouts. Runtime labels cannot replace architecture/tokenizer/template/layout validation.

| 9B format, same model revision | Full file bytes | Layout | Native Dawn preflight | New custom intake |
|---|---:|---|---|---|
|PTQ1_0|1,997,486,976|type143,128values/28bytes|accepted|existing route|
|PQ2_0|2,416,851,840|type142,128values/34bytes|accepted|checked admission|
|Q2_0|2,556,640,128|type42,64values/18bytes|accepted|checked admission|

Node/Dawn webgpu0.6.2, D3D12, Intel Iris Xe/gen-12lp, driver31.0.101.5186: an actual adapter/device was obtained, shader-f16 and subgroups were reported, and the pinned runtime's actual `checkAvailability` accepted each real header. This is native WebGPU binding evidence, not a PC browser or Metal result. PTQ1_0 uses the fully downloaded/hash-verified file. PQ2_0/Q2_0 use exact-revision HTTP206 first16MiB prefixes with validated Content-Range, per-prefix SHA and full-file sizes/expected SHA from the repository API. Their full weights were not downloaded or verified. Production intake checked all427tensor extents against declared sizes and found GPT-2 tokenizer metadata, chat template and qwen35 architecture in both alternatives.

`gguf-inspect.js` now checks PQ2_0 extents instead of leaving them unknown. Only checked qwen35/F32+supported ternary layouts are admitted to the existing adapter. Current group-64 Q2_0 is distinct from old group-128/type42 files, which still fail extent/overlap checks. Qwen3-based8B still lacks a matching engine and remains refused. Custom Add still requires complete-file hashing, user review and explicit preparation; the screen continues to say Execution not tested. The built-in9B PTQ1_0/default set is unchanged. Preflight/intake admission is not successful model loading, numerical parity, generation or phone fit.

## Unverified performance and quality

At the initial memory observation the PC had602,596KiB free physical memory; later1,067,144KiB. No9B weight residency/generation was attempted under that pressure. Historical PC9B load/READY evidence and the isolated256-exclamation-mark failure remain in MODEL-RUNTIME-VERIFICATION.md. The new verifier does not fix or certify that numerical/semantic failure. Japanese, multilingual and tool-call quality are unverified on this revision. Tests protect parsing/authority/cancellation, not language accuracy.

| Environment | Evidence in this change | Remaining |
|---|---|---|
|Windows/Node CPU|full9B verification before/after; exact SHA|browser/OPFS timing distribution|
|Windows/Dawn D3D12|real adapter/device;3packing header preflights|9B load, generation, Stop/reload, sustained speed/memory|
|iPhone Air/Safari|none|OS/browser version, Metal-backed WebGPU run, pressure/thermal/long-run/offline acceptance|
|Android browser|none|actual Vulkan-backed WebGPU availability/features and model execution|
|macOS browser|none|actual Metal-backed WebGPU load/quality/performance|

## Next investments

1. First diagnose9B numerical correctness with one isolated factual/Japanese/structured-output comparison across PTQ1_0 and PQ2_0 on a device with sufficient available memory. Preserve failed output and exact pins. Do not tune speed around a broken output path. The runtime lacks the model card's complete penalty controls; a sampler switch alone previously did not fix9B.
2. Then compare diagnostic pipeline1/4 using runtime decode timing, visible TTFT, peak GPU allocation and Stop/reload. Higher queue depth can hide readback latency but may increase queued work/state. A native Dawn result cannot choose Safari's setting.
3. Profile prompt prefill versus decode, allocation/repacking and resource ownership before adding kernels. The current runtime already selects supported f16/subgroups. Keep a hardware optimization only after equivalent outputs and material end-to-end gain are demonstrated.
4. Measure Decision/Text eviction cost on large models. The existing9B text-only preset avoids optional Decision residency; selected roles are not silently disabled. Multi-role scheduling and memory reclamation need actual device measurements.
5. Qualify additional runtime/model pairs when their architecture, tokenizer, custom ops, quantization and local asset delivery are verified. [WebLLM's model records](https://webllm.mlc.ai/docs/user/basic_usage.html) require their own prepared runtime/model assets; passing this GGUF to an arbitrary engine is not compatibility. Native MLX/Metal tools are references, not deployable iPhone PWA backends. [WebKit's WebGPU support](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) establishes the API, not9B speed/fit.

## Reproduction

`node scripts/qa/measure-model-hash.mjs 9B MODEL.gguf js OUTPUT.json` and `... wasm OUTPUT.json` stream an existing local pinned file without inference/network. The previous baseline JSON precedes both scheduling/accelerator changes; running `js` on current code measures the new scheduler with JS fallback.

`scripts/qa/probe-bonsai-webgpu.mjs` uses an explicitly installed optional Node/Dawn module via BABELSHELF_GPU_MODULE, a hash-verified local runtime, and an existing local model or retained bounded-header descriptor. It never launches a browser, fetches a runtime/model, or certifies generation. The optional Node package is QA-only and not a product dependency. `inspect-bonsai-alternatives.mjs` applies the production intake validator to retained exact prefix data and never registers a model.

The WebML runtime's redistribution license is still unstated; production retains direct pinned upstream preparation, not a vendored runtime. Hash-wasm is MIT with its separate shipped notice. No app data, model weights, raw upstream runtime, browser profile or credentials belong in the published evidence/archive.
