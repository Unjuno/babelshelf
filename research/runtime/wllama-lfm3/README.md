# LFM3 browser runtime research pins

This directory records source pins and the small patches used by the isolated LFM3 browser-runtime spike. These files are research evidence; the product-connected candidate and its separate asset manifest live under `design/prototype/runtime/wllama-lfm3/`.

## Pinned inputs

- Wllama: v3.12.0, commit `3bb2a46f0dab0b924e8cd992b85e8881c3d3a859` (MIT)
- llama.cpp submodule: commit `19cce6919992fdffd92e0ac152caaf1e2b8f254e` (MIT)
- Emscripten: 4.0.20
- Model: `LiquidAI/LFM3-1.7B-GGUF` at `b3f2ae5d73cd3c91bf40e8ba752c648aa05dffdf`, `LFM3-1.7B-QAD-Q4_0.gguf`; 1,049,615,680 bytes; SHA-256 `43a7d09a0e9cba91b63eb7052488b9564569bddfd65754d2e426465e572a7452`; LFM Open License v1.0

`source-pins.json` contains the runtime/model identities, build output hashes, one browser result, and the separate license identifiers. Keep model and runtime licensing separate when redistributing any artifacts.

## Patches

- `wllama-count.patch` adds a text-chat token-count action to the Wllama v3 worker protocol. It reuses the same message parsing and chat-template setup used by generation, then tokenizes the resulting prompt before generation.
- The Wllama patch also forwards `n_ctx_checkpoints` and `checkpoint_min_step` through the already-supported native load protocol. The bundled wrapper contains the matching forwarding lines.
- `llama-emcc-fix.patch` fixes a mixed integer-type `std::max` deduction failure in `deepseek41.cpp` and retains periodically spaced recurrent checkpoints inside long system/tool prompts. Previously a schema change before the first user boundary could discard the whole reusable prefix. Existing exact-token matching, checkpoint spacing and bounded eviction still govern restoration; arbitrary KV shifting remains disabled.
- Within that same checkpoint bound, eviction now preserves an early anchor and removes a crowded interior point instead of always discarding the oldest state. The incoming tail participates in the spacing calculation; replacement at an identical token position happens before capacity eviction. This retains coverage of early tool schemas in longer dialogue without increasing checkpoint count. Native prefix invalidation still discards checkpoints that do not match the new input.
- The checkpoint patch rebuilds both the WebGPU/JSPI and WebGPU/Asyncify compatibility engines. Generated JavaScript and WASM are paired, with source-patch and artifact hashes checked by `scripts/check-lfm3-runtime.mjs`. The old CPU-only artifact in `source-pins.json` is explicitly historical. The current adapter uses eight checkpoints and a 512-token minimum spacing; this does not establish memory fit at larger contexts or on phones.
- The Wllama patch also contains the one-argument compatibility adjustment needed for `format_prompt_rerank()` against this llama.cpp commit.

The patches were exported from the isolated built source tree. The Wllama reverse-apply check passed against that patched tree. These notes do not claim a clean-room rebuild has been repeated from the patch files alone.

## Browser result and limits

One PC Chrome run loaded the pinned QAD Q4_0 model with WebGPU and generation returned 40 prompt tokens; the new pre-generation count returned 40 for the same Japanese chat request. Generation produced five output tokens and `準備ができました。` with `enable_thinking=false`. See [LFM3 runtime spike](../../../docs/LFM3-RUNTIME-SPIKE.md) for broader PC CPU/GPU timings and their conditions.

The exact-count agreement is a single fixture, not coverage of tool calls, JSON output, long context, every chat-template branch, or model switching. It also says nothing about Safari/iOS, Android, thermal stability, PWA offline cold start, or user-facing answer quality. A later attempt at a broader prompt matrix stalled during model loading and did not reach those prompts; do not treat it as a model or counting failure.

The app has a separate LFM3 registration, WebGPU adapter route, explicit optional runtime asset role, pinned model manifest, and local GGUF intake/storage path. This remains a product-connected candidate, not yet release-ready. Later PC runs and controlled tests provide evidence for product asset verification, preparation and selected grounded/offline flows on their specific builds; they do not prove those flows on the current build or an iPhone. The current release gates, including runtime redistribution, real-model tool use, Stop/retry, warm reuse and installed offline cold restart, are tracked in [REMAINING-GATES.md](../../../docs/REMAINING-GATES.md).
