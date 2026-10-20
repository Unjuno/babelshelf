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
