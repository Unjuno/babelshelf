# Separate wasm32 / Asyncify GPU target

The default experimental GPU runtime uses JSPI and memory64. This target
instead uses the same frozen sources, Q2_0 GPU kernels, count and cancellation
patches with `WLLAMA_COMPAT=ON`, `LLAMA_WASM_MEM64=OFF`, and
`GGML_WEBGPU_JSPI=OFF`. It is a separately built ABI, not a browser user-agent
spoof or a fallback to remote inference. A successful PC run is not Safari or
iPhone acceptance.

Apply the four patches in [Q2-WEBGPU-BUILD.md](Q2-WEBGPU-BUILD.md), plus
`patches/wllama-large-file.patch` to the wllama checkout. Its source and patch
hashes are recorded in `large-file-pins.json`. Leave the original CPU checkout,
shipped assets and the existing JSPI build directory untouched.

Configure as in that document, using a new `build-count-q2-webgpu-compat`
directory and replacing the three options above. Keep WebGPU enabled and
Release optimization. Build `wllama` with one job. Then:

```text
node scripts/qa/package-q2-webgpu-runtime.mjs SOURCE NEW_PRIVATE_OUTPUT compat
node scripts/qa/serve-q2-webgpu-runtime.mjs PRIVATE_OUTPUT PINNED_QWEN3_06B_FILE 4271
node scripts/qa/check-wllama-stream-abort.mjs PRIVATE_OUTPUT/wllama-count-q2-webgpu.js
```

The packager verifies the ABI-specific cache values, all five patch/source
chains, native artifacts and stale-build guards. It records a distinct
`largefile1-compat` identity. The QA page explicitly selects `compat:true`
and the hashed local `wllama.js` / `wllama.wasm` pair on Chrome too. No CDN
compat resources are selected. The page records actual selected resources,
native GPU errors, token counts, generation, cancellation and fresh-Worker
reload. This tests the alternative ABI; it does not emulate Safari.

## Actual file-offset defect and repair

The original async `fread` wrapper calls `ftell` / `fseek`, whose `long` is
32-bit in wasm32. At and beyond 2 GiB, the observed read request contains
offset `-1`. Even a read beginning below 2 GiB can leave the file position
wrong when it crosses the boundary. Separately, `size_t` arguments crossing
the wasm32 i32/JavaScript ABI arrive signed, so replacing only `ftell` is
insufficient.

The repair uses `ftello` / `fseeko` for file positions, checks failed or
unrepresentable positions, and converts wasm32 arguments to unsigned values
inside the async JS stub. BigInt conversion is retained for memory64.

`check-wllama-large-file.mjs` compiles the actual source header with Emscripten
4.0.20 and executes it in Node using a synthetic sparse MEMFS file with the
same size-only node contract as upstream's async model file. The virtual
file is 2,310,125,920 bytes, matching the pinned original Bonsai 8B asset size;
no model contents or inference are simulated. The probe's WASM ceiling is
32 MiB. Deterministic bytes test actual read offsets and libc positions.

Thirteen cases cover small cached/repeated reads, direct reads over 1 MiB,
2 GiB crossing, positions before/at/after 2 GiB, and short reads/EOF at the
file end. A cached range crossing wasm32 SIZE_MAX must be refused before read/copy. Original header passes 2/13; repaired header passes 13/13. Raw
receipts are `wasm32-large-file-{before,after}.json` in the evaluation folder.

```text
node scripts/qa/check-wllama-large-file.mjs SOURCE EMSDK_ROOT NEW_PRIVATE_OUTPUT
```

This fixes one prerequisite for a 2.31 GB model; it is not proof that the full
model fits or generates correctly. File positions beyond wasm32 `SIZE_MAX`
and reads whose requested end exceeds SIZE_MAX are explicitly refused. Cache comparisons use subtraction to avoid wrapping. Over-4-GiB models, actual heap pointers beyond 2 GiB,
GPU residency/peak memory, mobile memory pressure, heat, device-loss recovery,
offline cold restart and Safari execution remain separate requirements.
