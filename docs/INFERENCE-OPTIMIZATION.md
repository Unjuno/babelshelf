# Local inference optimization — 2026-10-21 JST

## Resident identity includes declared asset pins

The router's original resident-session optimization compared only ID, model revision, runtime revision and context. A changed declared model or runtime file SHA under the same revision labels could therefore reuse a stale session. A controlled router regression reproduced the skipped reload, then passed after identity serialization was widened to the selected model descriptor, runtime descriptor and context. This captures the asset pins and adapter metadata those descriptors expose, without including unrelated model entries. A repeated unchanged request still avoids unloading/reloading. Stored identity is an immutable string snapshot, so later descriptor mutation cannot retroactively change it.

This does not replace backend verification or discover changed on-disk files by itself. Backends still own complete file hashing, prepared status, runtime ownership, source validation and Stop. App-owned factory replacement and exclusive engine switching remain unchanged. The regressions use controlled backends to check routing/ownership; they are not a new native GPU generation, hash-corruption recovery or phone result. Prototype583, product4, protected runtime28, check33 and both preview/product builds pass; productff9234453db72414/121. Product acceptance was rerun after the actual product build, separately from the preview build. Existing large-chunk warnings remain.

## Existing sharding and controlled buffer-limit planning

The original Intel support plan's1,728,053,248-byte main bits buffer is not a universal minimum per binding. The exact runtime already partitions that pack according to device limits. Adding a static product rule that rejects all adapters below that original buffer size would incorrectly reject configurations the planner supports. No such product/UI rule, automatic selection or download restriction was introduced.

`probe-bonsai-webgpu.mjs` now supports an optional `BABELSHELF_PLAN_BUFFER_CAP` aligned byte value, only with `BABELSHELF_NUMERICAL_PLAN=1`. It may lower both maxBufferSize and maxStorageBufferBindingSize in a copied descriptor passed only to the pinned runtime's header support planner. It refuses a raised, invalid or unaligned value. The real native GPU device and its actual limits remain unchanged and recorded separately; actual checkAvailability and projected allocationPlan results must not be conflated. No weight buffers are allocated or generated tokens measured.

Same Windows11/Intel/Dawn/D3D12 and pinned9B header/runtime results:

| Planner inputs | Header plan result | Meaning |
|---|---|---|
|Actual2GiB buffer/binding limits|Accepted, one1,728,053,248-byte bits pack|Earlier native evidence; not full residency/quality|
|Controlled256MiB limits|Accepted, seven main LUT2 bits shards, each at most268,435,456bytes|Existing partitioning handles this cap; no new sharding implementation|
|Controlled128MiB limits|Rejected: lmHeadQ4 requires254,279,680bytes (242.5MiB); embedBits is the same size|The standalone head/embed remain a limit even though main packs split|

The accepted256MiB plan still totals2,405,812,224weight bytes; sharding does not reduce that sum, prove available system memory or include cache/temporary/browser/driver peaks. Evidence `9b-plan-256m.json` and `9b-plan-128m.json` explicitly separates controlledPlanningLimits from real device.limits. These are not simulated iPhone runs or assertions about iPhone Air/Safari's actual limits. A rejected projected plan exits1 even when the preceding actual-adapter availability is true. An attempted4GiB projection above the observed2GiB limit was also rejected with the explicit lower-only error.

The user-triggered product device check currently reports storage/adapter observations and explicitly says loading/generation untested. A browser adapter alone is not a9B acceptance gate. The next architecture investment for a genuinely smaller-cap target would be qualifying chunked head/embedding access in addition to existing main-pack sharding, after observing that target's actual capabilities. Preserve this evidence rather than duplicating partitioning already present. QA/docs changed only; publicv103 and production runtime remain unchanged.

## Explicit head-activation trace, not a speed benchmark

`scripts/qa/trace-bonsai-activations.mjs MODEL_ID LOCAL_GGUF PINNED_RUNTIME OUTPUT.json [backend]` now prepares a bounded native diagnostic run using only a manifest-pinned existing local model and runtime. Set BABELSHELF_GPU_MODULE explicitly to the optional QA package. The runner disables network, verifies the complete local model hash before inference, selects context512/pipeline1/greedy, uses a fixed public garden prompt and at most eight generated tokens. It never reads application storage or becomes a PC/LAN/app inference backend.

The QA-only `bonsai-activation-trace.mjs` rejects any different runtime SHA and changed single-match instrumentation boundaries. It adds three output retentions in the actual Prism head and compile hooks in decode/prefill sessions, only in a local instrumented copy. The observer intercepts next-token readback and collects hidden, normalized/rotated hidden and logits statistics: finite/NaN/infinity counts, first nonfinite index, extrema, zeros, mean, population variance and smallest maximum index. Raw activation arrays are not saved. Readback is bounded to2MiB per snapshot and four snapshots; each snapshot is persisted immediately. Settings, knowledge, model selection and production assets are untouched.

Retained outputs change graph pooling/lifetimes, and sequential GPU readback changes timing; no throughput/TTFT/memory comparison may use this trace. The diagnostic4GiB free-system-memory prerequisite is an operational guard, not a model-fit estimate, browser limit or phone compatibility rule. It applies only to this explicit native diagnostic command. Other GPU limits, allocation peaks and device loss can still fail a run. A missing trace is a failed diagnostic, not evidence that activations were valid.

Real native Windows11/Intel/D3D12/Dawn0.6.2 `self-check - PINNED_RUNTIME OUTPUT.json` compiled a small StridedCopy/SampleNextToken graph with three retained outputs. The observer recorded a finite32-score vector selecting token27, then all32NaNs selecting0 with null extrema/variance/argmax, and refused a third snapshot. This verifies compiled GPU execution, readback ordering, counters and bounds on arithmetic fixtures, **not the instrumented model session hooks or9B checkpoint execution**. Three Node tests cover mixed nonfinite/f16 statistics, hash identity and bounds; syntax checks pass. The first local helper launch used an incorrect relative import and failed before runtime instrumentation; fixed paths precede the successful observations.

The full9B diagnostic command was invoked, but it recorded status `not-run` and exit2 before instrumentation/loading: available1,027,162,112bytes versus4,294,967,296-byte prerequisite. Evidence files are `activation-trace-self-check.json` and `activation-trace-9b-attempt.json` in the retained evaluation directory. No full9B logits, semantic improvement, generation-speed or phone result is claimed. The next meaningful use is the same full command when memory is available; inspect actual final hidden/logits before changing working shaders. Product/publicv103 remains unchanged because these files are QA-only.

## Latest investigation: actual Prism output route and invalid logits

The exact pinned runtime's Prism/Hadamard head branch (`gw`/`_w` in the inspected bundle) normalizes/rotates the final hidden vector, emits `com.xenova.LlamaPrefillMatmul` into float32 vocabulary logits, then calls `com.xenova.SampleNextToken`. It does not use the generic fused LlamaDecodeLmHeadArgmax path. Attempting to instantiate that generic op in this pruned bundle returned "This feature is not included in this bundle"; this is a diagnostic targeting error, not a demonstrated product failure. Follow actual graph selection rather than testing similarly named unavailable operators.

`scripts/qa/check-bonsai-token-selection.mjs PINNED_RUNTIME_FILE OUTPUT.json [backend]` tests the actual SampleNextToken operator. It requires the same explicit optional BABELSHELF_GPU_MODULE, exact runtime hash, private local-only instrumentation and disabled network as the embedding probe. Wrong-pin rejection before instrumentation and Node syntax checks pass. Retained evidence is `research/evaluations/inference-optimization-2026-10-21/token-selection-parity.json`.

Actual Windows11 build26200 / Node24.6.0 / webgpu0.6.2 / Intel Iris Xe gen-12lp / D3D12 driver31.0.101.5186: eight controlled score-vector cases at the real9B vocabulary size248,320 pass. `block_lists` selects the correct first/last token, indices2047/2048 across candidate blocks, a negative maximum at ID200003, the smallest tied ID across blocks, a valid maximum with some NaNs excluded, and a deterministic topK1 positive-temperature case. Both adjacent uint32 output sentinels remain intact with outputOffset1. Expected IDs come from independent CPU selection, not an expected language answer. General stochastic distribution, arbitrary sampling settings, full-model logits and other adapters remain unverified.

A separate deliberately invalid all-NaN vector returned token0. It has expected=null/passed=null and is not counted among the eight pass cases. Bounded header inspection of the already full-hash-verified9B source identifies tokenizer.ggml.tokens[0] as `!` and token count248,320. Thus invalid logits can yield the same visible punctuation as the historical collapse on this selector. **This does not prove the failing9B run actually produced NaNs.** A uniform finite vector could also select token0. Preserve this as a concrete hypothesis; the next full-model observation should inspect finite counts, extrema and variance of final hidden/rotated hidden/logits before changing correct selectors or sampling defaults. Do not replace an invalid output with guessed prose or claim semantic repair.

Only QA/evidence/docs changed. Production/runtime hashes, model presets, user knowledge and publicv103/fd895ca6636791e4 are unchanged. No new model-load, generation-speed, browser or phone claim; no redundant app publication or product test rerun.

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

Published as Sitev102 at https://babelshelf.com/, product29ed0f58ab9d059d/121, canonical implementationbcc1433. Independent HTTPS main/SW hashes match. Publication does not establish adoption by open clients or browser inference acceptance.


## Follow-up: bounded numerical kernel checks

The next investigation uses actual pinned-runtime GPU kernels without allocating a whole model. `scripts/qa/check-bonsai-hadamard.mjs` requires the exact runtime SHA above, then adds QA-only exports to a local output copy. It does not change the pinned production file, shader source, model selection, app assets or runtime license policy. No upstream bundle is committed. Optional native Node/Dawn is explicitly supplied via BABELSHELF_GPU_MODULE; backend can be d3d12/metal/vulkan. This is not an app startup benchmark or a browser launcher.

Actual Windows11 build26200 / Node24.6.0 / webgpu0.6.2 / Intel Iris Xe gen-12lp / D3D12 driver31.0.101.5186 results are in `research/evaluations/inference-optimization-2026-10-21/hadamard-parity.json`:

- Actual9B header declares block4096, hidden4096, intermediate12288 and32linear-value/16linear-key heads. These dimensions motivate fixtures; the numerical probe does not execute9B weights or tokenize a prompt.
- Fourteen BlockHadamard checks cover float32 forward widths4096/12288, three-row prefill, inverse lookup, RMS fusion, gated RMS and the16-group/repeat2 input permutation. Each runs the device-selected optimized variant and an available portable workgroup variant against an independent double-precision CPU formula. All finite, max absolute error1.1293206405582623e-6, tolerance1e-4. The fixtures use bounded nonzero inputs and explicit +/-1 signs; they are numerical test vectors, not fabricated language answers.
- Six actual GPU exact-Q4 transcodes cover PTQ1_0/PQ2_0/Q2_0 with float32/float16 scale storage. Independent known-value encoded fixtures include the three ternary values and all four2-bit levels where supported.10,240scalar values and320scales matched with zero mismatches. PTQ fixtures encode base3 digits before running the runtime's real shader. Scales0.5/1 do not exercise underflow/extreme values.
- This adapter reports subgroup widths8-16. Its ordinary subgroup/workgroup paths pass for these fixtures; the wave32-only staged paths used by some other adapters are not tested. Hadamard float16 activation/output, LUT2 packing/matmul, full9B layers, recurrent-state updates, logits and semantic quality remain unverified. Passing exact-Q4 transcodes says nothing about whether every production projection selects that packing.

This evidence narrows the failure investigation: do not replace the tested float32 transform/Q4 codec merely on the basis of the prose collapse. Next inspect the actual selected LUT2 packing and matrix products, then recurrent/prefill-vs-decode state and logits. The historical9B failure is still unresolved. Current physical memory was417,644KiB free at the follow-up observation, so no new full9B residency was attempted.

Reproduce with `node scripts/qa/check-bonsai-hadamard.mjs PINNED_RUNTIME_FILE OUTPUT.json d3d12` after setting BABELSHELF_GPU_MODULE to an explicitly installed optional webgpu module entrypoint. Keep OUTPUT.json and its instrumented `.runtime.mjs` sibling outside the source/package. The tool refuses any different runtime hash before internal-name instrumentation. GPU/driver-specific results must remain scoped to that device. This follow-up changes QA/evidence only; the public product remains v102/build29ed0f58ab9d059d.


## Follow-up: LUT2, recurrent state and the real9B payload

Additional native checks use the same Windows/Intel/Dawn setup and exact runtime SHA, with no browser launch, product changes or full9B allocation. New QA commands are `check-bonsai-lut2.mjs PINNED_RUNTIME_FILE OUTPUT.json [backend]` and `check-bonsai-recurrent.mjs PINNED_RUNTIME_FILE OUTPUT.json [backend]`, both with an explicit BABELSHELF_GPU_MODULE. Private exports exist only in their local instrumented output copy. Generated test vectors are arithmetic inputs, never model answers. Final evidence JSON is retained beside the earlier evidence.

| Actual check | Evidence and limits |
|---|---|
|LUT2 packing and matrix products|12/12pass, PTQ1/PQ2/Q2, K4096/N256, M1/3/32, exact-f32 route. Nine nonuniform matrices have256distinct first-row reference outputs; block offsets0/8 cover packed placement. Selected actual kernels are lut2_decode_gemv_mr2 and lut2_tiled_exact_register_rows. Maximum absolute error0.0004060844294144772, below0.001. No packing/scales mismatches. This does not cover all fused decode projections, shapes, approximate/int8 or other adapters.|
|Small scale boundary|Three of the12cases use known positive weights and seven exact FP16 scales including0x0001 (5.960464477539063e-8),0x03ff/0x0400 boundary and non-power-of-two normal scale. Relative as well as absolute error is checked so an all-zero answer cannot pass merely because the values are small. All three have zero error on this adapter.|
|GatedDeltaNet|17-token sequence,32value/16key heads, key/value head dimensions128, nonzero initial float32 state. Actual prefill_vec4_gather and17sequential decode_vec4_gather calls agree with a double-precision gated-delta reference; maximum output error8.673035224032732e-9, state error1.6030084194068595e-8, tolerance1e-5. F16 state, other variants, checkpoint projection layout and arbitrary lengths remain separate.|
|Tiled/grouped permutation|Actual ai.onnx.Transpose inner_vec4 with [1or17,2,16,128] to [1or17,16,2,128] has zero mismatches. This tests the fallback transpose used before a folded output projection; it does not validate the trained checkpoint's projections.|
|Full9B tensor scalar audit|Entire1,997,486,976-byte pinned PTQ1 file hashed again and matched3561df7ac7d26a71ffa991ac2db740b10841c3a350aa2676ccd3ff5d428b4e8b. All427tensors covered:7,352,832F32 scalars and69,894,144FP16 quantization scales (77,246,976total), none NaN/Infinity, no missing scalar ranges. FP16 scale extrema5.960464477539063e-8..0.267822265625. Finite weights do not establish correct trit order, layer numerics or useful generation.|

The audit is `node scripts/qa/audit-bonsai-tensors.mjs 9B PINNED_LOCAL_GGUF OUTPUT.json`. It validates the production GGUF container, uses bounded8MiB streaming chunks, scans F32 values/FP16 quantization scales and hashes the full byte stream. It neither allocates tensors on the GPU nor decodes all quantized values into a dense model. Its elapsed8,874.54ms includes scalar inspection and hashing under different file-cache conditions; it is not a new before/after benchmark and must not replace the earlier measured pair.

The pinned [Prism conversion source](https://github.com/PrismML-Eng/llama.cpp/blob/73bfe6cc485554822f80c473a3c0c4f25e80f41b/conversion/qwen.py#L406) documents tiled value-head ordering and retention of grouped input order for Hadamard-folded out projections. The real9B header has `prism.hadamard.gdn_v_grouped=true`; the inspected runtime explicitly transposes that folded projection's input. The recurrence reference uses the operator's tiled internal order. The [Transformers recurrence](https://github.com/huggingface/transformers/blob/main/src/transformers/models/qwen3_5/modeling_qwen3_5.py) was consulted for the mathematical state update, not used as a remotely executed inference engine. These observations do not prove all checkpoint-to-graph mappings correct.

### Static weight allocation plan, not peak memory

`BABELSHELF_NUMERICAL_PLAN=1` adds an optional exact-hash QA plan inspection to `probe-bonsai-webgpu.mjs`. The real header and actual device limits drive the pinned runtime's own support planner, without loading weights. Errors or rejected plans now produce a nonzero exit even if the preceding public compatibility check was positive. The local instrumented bundle remains outside source/deployment. The plan records its native package version and device limits.

On this Intel adapter (maxBufferSize/maxStorageBufferBindingSize2,147,483,648), the9B support plan accepts these weight buffers:

| Planned buffer | Bytes |
|---|---:|
|lut2_128Bits|1,728,053,248|
|lmHeadQ4|254,279,680|
|embedBits|254,279,680|
|lut2_128Scales|108,003,328|
|weights|29,411,328|
|lmHeadQ4Scales|15,892,480|
|embedScales|15,892,480|
|Total|2,405,812,224|

Here lut2_128 names the group128 metadata route; the matmul API uses format lut2_32 with codebook9, while current Q2_0 uses codebook8. The visible lmHeadQ4 label does not by itself establish the underlying bit width. The plan excludes or does not establish actual cache/activation/tokenizer/readback/temporary-upload/browser/driver peaks and thermals. It is not a phone memory requirement or available-memory check. OS free physical memory at the later observation was960,848KiB; no full9B load/generation was attempted.

The historical isolated9B punctuation collapse is still open. Bounded float32 transforms, the tested LUT2 products, the recurrence operator, the tested transpose and finite source scalars did not reproduce it. The next useful boundary is actual selected fused projections/embedding/logits during an isolated full-model run with adequate available memory. Preserve the failure and find the first divergent/nonfinite activation before changing working kernels. Product remains v102/build29ed0f58ab9d059d; these QA/evidence-only changes need no new app deployment.

## Sidebar verification and viewport follow-up

The existing Codex sidebar browser was operated through Computer Use under the user's explicit instruction. Public/local origins retained older app shells and were explicitly updated without clearing stored data. A real reload defect left existing dialogue at its oldest turn when metadata hydration completed last. The conversation effect now waits for all hydration gates; controlled regression fails before and passes after. Local sidebar adopted buildfd895ca6636791e4/pageindex-Ce7e_Iau.js and displayed the latest retained turns. Published as Sitev103, canonical9ee6790; prototype582/product4/protected28/check33/build pass. This viewport fix changes neither inference architecture nor language quality. No new full9B load was attempted with only532,412KiB free physical memory. Earlier numerical and verifier measurements retain their original scope.

## Follow-up: isolate embedding lookup and fused inverse rotation

`scripts/qa/check-bonsai-embedding.mjs PINNED_RUNTIME_FILE OUTPUT.json [d3d12|metal|vulkan]` uses the same explicitly provided optional BABELSHELF_GPU_MODULE and exact runtime SHA as the earlier native checks. It refuses a different runtime before writing the local instrumented copy; an explicit wrong-pin check confirmed this behavior. Network is disabled. Private internal exports exist only in OUTPUT.json.runtime.mjs outside the repository/deployment. This tool introduces no product dependencies or runtime redistribution.

Actual Windows11 build26200 / Node24.6.0 / Dawn webgpu0.6.2 / Intel Iris Xe gen-12lp / D3D12 driver31.0.101.5186 results are retained in `research/evaluations/inference-optimization-2026-10-21/embedding-parity.json`. Fourteen checks passed:

- Twelve actual LlamaEmbed fused lookup/inverse-Hadamard checks: LUT9 group128 (PTQ1/PQ2 route) and LUT8 group64 (current Q2 route), width4096, five distinct constructed vocabulary rows, selected first/second/last tokens, explicit tokenOffset1 with a different decoy at0, nonuniform quantized values/scales and +/-1 signs. The CPU reference independently decodes known scalar values and applies an FP64 butterfly, normalization and post-transform signs. Auto selected lut2_inverse_rotation_subgroup; explicitly requested lut2_inverse_rotation exercises the portable kernel. Maximum absolute error5.224719643592834e-7, below1e-4; all finite, all4096 reference outputs nonzero in each case.
- Two actual prefill_lut2 lookups: reordered tokens[4,0,1] at width4096 for both LUT layouts, no inverse rotation in this operation; all12,288 outputs per layout match the scalar reference exactly.

The fixtures include FP16 subnormal/normal scales and non-power-of-two normal scales, but this combined-rotation absolute-error check does not independently certify tiny-scale relative precision. These are already packed arithmetic inputs, not another upstream codec test, trained embedding rows, real tokenizer IDs, checkpoint sign generation or semantic output. Float16 hidden/output paths and other adapters remain unverified. No full model or generation is loaded; the PC had only235,500KiB free physical memory before this bounded check. Do not infer phone capacity, TTFT or decode throughput.

Together with the prior evidence, these selected float32 embedding kernels do not reproduce the historical punctuation collapse. Preserve working production shaders; the remaining useful investigation is actual checkpoint-to-graph mapping and selected fused projections/final logits in a memory-sufficient full run. Product/public build remains v103/fd895ca6636791e4; this QA-only addition needs no redundant deployment or product test rerun.

Resident-identity follow-up is published as Sitev104 at https://babelshelf.com/, productff9234453db72414/121, canonical9887b46. Main/SW HTTPS bytes match and actual existing sidebar client adopted that worker/page after explicit update/reload with stored dialogue retained. No new semantic/model-switch/phone acceptance follows.

## Real checkpoint row products — 2026-10-21

The LUT2 probe now accepts an optional existing pinned local9B path after its backend argument. `bonsai-checkpoint-fixtures.mjs` verifies full file size/SHA, validates the GGUF through the production inspector, parses actual tensor shapes/offsets and reads bounded256-row windows from output.weight, token_embd.weight and blk.0.attn_qkv.weight. For each tensor it selects first/middle/final windows, independently decodes PTQ base-three digits and FP16 scales, and records window byte positions/SHA without saving weights. Each window is229,376encoded bytes. File stat must stay stable through extraction. No full model allocation, application storage, downloads or production import.

Reproduce: set BABELSHELF_GPU_MODULE to the optional native webgpu entry, then `node scripts/qa/check-bonsai-lut2.mjs PINNED_RUNTIME OUTPUT.json d3d12 PINNED_LOCAL_9B`. Keep the output and private instrumented runtime sibling outside deployments. Wrong-size checkpoint rejection was checked before GPU setup; exact runtime and full model hashes remain mandatory.

Windows11 build26200/Intel Iris Xe/D3D12, Node24.6.0/webgpu0.6.2, same pinned9B/runtime revisions:12/12 actual GPU row products pass. Nine distinct windows K4096/N256 with M1, plus M3/blockOffset8 for each first window. Selected lut2_decode_gemv_mr2; all quantization values/scales exact, output finite, maximum absolute error5.790777777292533e-7 against scalar FP64 accumulation, below the unchanged0.001 tolerance. Retained9b-checkpoint-products.json contains conditions and source hashes. Existing12 synthetic PTQ/PQ/Q2 cases also pass unchanged, including tiled M32. This is sampled checkpoint arithmetic evidence, not a speed benchmark or logits from a real prompt: inputs are fixed constructed float32 vectors, no sign reconstruction/normalization/recurrence/full layer graph/tokenizer or real model generation. The9B prose collapse remains unresolved; next useful evidence is full-model intermediate activations on a memory-sufficient device. Current PC free physical memory before this probe was885,124KiB, so no full9B retry was attempted. Productv106 remains unchanged; QA-only evidence needs no app rebuild/deployment.

## Stored checkpoint signs and inverse embedding — 2026-10-21

Rechecked the upstream Space API and commits/main: latest remains621e20782f208660f4f58283c2ce58430020f243, identical to the production pin. The exact upstream application assets/index-625vxx6U.js uses Qwen3_5ForConditionalGeneration.from_pretrained, maxLength and enable_thinking. It supplies an mmproj and leaves several defaults implicit; BabelShelf deliberately text-only uses mmproj:null, disabled prefix snapshots and pipeline1. No known corrective update or proved cause was found; those differences are not reasons to change production without a reproduction. Primary sources: https://huggingface.co/api/spaces/webml-community/ternary-bonsai-2-hermes-webgpu/commits/main and the exact pinned application file. The first metadata print encountered Windows cp932 emoji encoding; reprinted only ASCII-safe selected metadata successfully.

The QA checkpoint helper now retains/validates the stored prism.hadamard version1, block4096, explicit signs, input-last-dimension transform and inverse token embedding contract. It independently parses16,384 signs for widths4096/12288; width4096 has2,018 negative signs. Optional existing-checkpoint argument in check-bonsai-embedding.mjs compares all stored signs and the inverse embedding marker with the actual pinned runtime GGUF reader/rotation parser (header-range reads only, max16MiB). No signs or weights are copied into product settings.

Command: `node scripts/qa/check-bonsai-embedding.mjs PINNED_RUNTIME OUTPUT.json d3d12 PINNED_LOCAL_9B`, with explicit optional BABELSHELF_GPU_MODULE. Native Windows11/Intel Iris Xe/D3D12/webgpu0.6.2, exact runtime/model revisions and full checkpoint hash as earlier:21/21 pass. Three256-row windows from token_embd.weight (first/middle/final), each independently decoded/repacked into a local LUT9 window; sampled local IDs0/1/255 correspond to checkpoint IDs0/1/255,124160/124161/124415,248064/248065/248319. Eighteen inverse transforms with real signs cover auto subgroup and explicit portable variants; every sampled result exactly equals the CPU FP64 butterfly reference. Three reordered prefill lookups are exact. Real-token labels record source row identity; the GPU vocab is reindexed256, not the full248,320-row table. Runtime sign parser agrees on all16,384 values. Evidence9b-checkpoint-embedding.json saves mapping/row hashes/conditions/results, no raw arrays.

The LUT2 packed words are assembled independently from scalar checkpoint decoding; actual runtime PTQ codec for those rows was covered in the preceding matrix-product check. This does not test whole production loading/sign-buffer ownership, full-vocabulary embedding addressing, post-embedding layers, real prompt activations, sampling quality or phone performance. The historical9B punctuation collapse is still unresolved. Prior14 constructed embedding checks pass;12 checkpoint matrix cases also pass after the metadata-helper extension. Wrong runtime SHA is refused before instrumentation/GPU; syntax and diff checks pass. Initial free memory was low, later859,484,160bytes before the bounded GPU check (command required at least256MiB). No full9B execution was attempted and no unrelated process was terminated. Product/publicv107 is unchanged because this is QA/evidence only.

## Real2B full-model diagnostic and observer repair — 2026-10-21

The fixed initial2B asset was downloaded to the task QA directory (not app storage or Git),429,183,456bytes, complete SHA36061ad406df8a4903a6db005be350c50fabfaf717f9ef0acf4b76adcd9929fa. Native header/support planning on the same Intel/D3D12 adapter accepts; static weights506,313,984bytes, largest LUT bits342,884,352bytes. This is separate from phone compatibility.

The activation diagnostic's original4GiB operational floor was specific to the intended9B workload but applied to every model. For the pinned2B only, the runner now requires768MiB free before loading (~285MiB beyond the measured static weight plan) for context512/eight-output-token diagnostics. All other models retain4GiB. These are operational QA floors, not peak-memory predictions or product compatibility gates. First2B attempt refused before load at781,668,352bytes; after the task's unused local4215 QA server was stopped, a fresh attempt passed at809,029,632bytes. Other user apps were not terminated; the public site was unaffected.

The first actual model attempt exposed an observer bug during compiled warmup: qwen35-decode has no next_token tensor. Its sampler writes input_ids in place; only prefill exposes next_token. The tracer now observes the correct tensor for that decode graph. A controlled RED/GREEN test covers this identity. The resulting first successful run also captured warmup readbacks before the prompt, which consumed half of its four-snapshot budget. A second controlled RED/GREEN adds shouldObserve gating; the real runner now arms only immediately before generation, records phase on each snapshot and disarms in finally. Warmup traces must never be called prompt evidence.

Final real model execution (activation-trace-2b-generation.json): Windows11 build26200, Intel Iris Xe/D3D12, Node24.6.0/webgpu0.6.2, model revision683f7be2629342a50987627b40881e54761a2430/PTQ1_0, fixed runtime621e20782f208660f4f58283c2ce58430020f243/full hash unchanged. Network disabled, local full-hash-verified assets, context512, pipeline1, greedy, fixed garden prompt,21input/8outputtokens. Generated `A quiet garden is filled with the soft`, finish length at the deliberate cap. The final generation run started with2,847,338,496free system bytes; the successful generation is not a768MiB host-memory demonstration. After-load runtime memoryStats reported live775,028,848/peak775,028,852bytes before generation, not whole-process RAM or final peak. Four generation-only snapshots (one prefill, three decode) all have finite hidden/normalized-rotated/logits. Prefill argmax32, then11012/13159/369. All248,320logits are read each snapshot, within2MiB bounds. This is a bounded real generation success and verified actual session compile hooks; it is not broad2B Japanese/tool quality, uninstrumented performance, app/browser/phone/offline cold-start or9B recovery acceptance. Readback/retained outputs alter allocation/timing.

Retained initial not-run and instrumentation-failure JSON plus2B header plan preserve the failures. The intermediate run containing warmup snapshots is retained only in task outputs and is superseded for prompt evidence. Five diagnostic Node tests pass, syntax/diff checks pass. No product source/model selection/data changed and no deployment was required (publicv107 remains). Native full9B remains memory-blocked; the corrected diagnostic can now separate its actual prompt activations from warmup when resources allow.
