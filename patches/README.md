# Experimental local-runtime patches

`llama-cpp-q2_0-webgpu.patch` targets llama.cpp revision
`46ca246de9bb1c35269722a6240d37d9dfd79cad`. It adds official group64/type42
Q2_0 row extraction, vector multiplication and tiled matrix initialisation,
plus the corresponding backend and shader-selection registration. It does
not add Prism group128, PQ2_0, PTQ1_0 or Bonsai2 Hadamard support.

The upstream source is MIT licensed; attribution is retained in
[llama-cpp-MIT.txt](../design/prototype/licenses/llama-cpp-MIT.txt).
This patch is **not linked into or enabled in the product runtime**.

Reproduce the isolated source and patch without changing the frozen checkout:

```text
python scripts/qa/build-qwen3-q2-webgpu-patch.py PINNED_LLAMA_SOURCE NEW_WEBGPU_DIRECTORY
```

The generator refuses a wrong revision, tracked source changes, an existing
destination, or a destination inside the source. Its manifest hashes UTF-8
text with LF normalisation. Two independent outputs produced the same patch
SHA-256; `git apply --check` passes on the frozen source.

Numerical checks use the upstream C++ `pre_wgsl.hpp` preprocessor, not a
replacement macro parser. Compile `scripts/qa/preprocess-wgsl.cpp` with that
header on the include path, then run:

```text
node scripts/qa/check-qwen3-q2-webgpu.mjs PATCHED_WEBGPU PREPROCESSOR_EXE NEW_RESULTS [PINNED_8B_FILE FULL_SHAPE_AUDIT]
node scripts/qa/serve-qwen3-q2-webgpu.mjs PASSED_NODE_RESULTS 4268
```

The Node runner requires `BABELSHELF_GPU_MODULE` pointing to the installed
Node/Dawn module. The browser check uses the same generated WGSL and shared
GPU/reference cases in the existing Codex sidebar. Real row bytes remain in
private outputs and are not committed or deployed.

Windows/D3D12 Node and sidebar Chrome checks pass controlled and real 8B row
cases. Emscripten syntax and object compilation pass. These checks do not
cover complete backend pipeline selection, binding offsets/batches, subgroup
matrix variants, a linked WASM runtime, full-model generation, decoding speed,
mobile memory, Safari or Metal. Full integration and model validation remain
required before this is eligible for product adoption.

A separate GPU/count distribution has now been linked and executed with a
real small Q4_0 model in the sidebar browser. See
[Q2-WEBGPU-BUILD.md](../research/runtime/wllama-count/Q2-WEBGPU-BUILD.md) and
`q2-webgpu-runtime-*.json` evidence. This still does not certify full-model
Q2_0 dispatch or original 8B/Bonsai2 9B. Product GPU admission remains unchanged.

`wllama-stream-abort.patch` targets the pinned wllama revision after its count
patch. It suppresses queued content after abort while awaiting actual native
cancellation/error, and rejects normal completion after a requested abort.
Its hash/source chain is recorded in `stream-abort-pins.json`. The wllama MIT
notice is retained in `research/runtime/wllama-count/UPSTREAM-LICENCE`.
