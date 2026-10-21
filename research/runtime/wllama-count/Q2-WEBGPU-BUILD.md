# Separate experimental GPU/count runtime

This build is independent of the shipped CPU/count distribution. It combines
the existing count patch with the official group64 Q2_0 WebGPU patch. It does
not register a product backend, change a model policy, or modify saved data.
The JSPI/memory64 variant is a PC integration target, **not Safari/iPhone
acceptance**. A compatible mobile distribution still needs its own build and
execution evidence.

Start with a new private clone of wllama at
`7ed17361caf221a84aa1e80ca85a3d6324f3af85`, with its `llama.cpp` checkout at
`46ca246de9bb1c35269722a6240d37d9dfd79cad`. Apply
`research/runtime/wllama-count/count.patch`, followed by
`patches/wllama-stream-abort.patch`, to wllama and
`patches/llama-cpp-q2_0-webgpu.patch` to llama.cpp. Preserve the original CPU
checkout and build directory. On Windows, set `core.longpaths=true` locally
before checking out llama.cpp; otherwise deeply nested upstream UI files can
leave an incomplete checkout. Do not discard other work to repair a checkout.

Use the pinned Emscripten 4.0.20 SDK and its `EM_CONFIG`, with Ninja. The SDK's
built-in emdawnwebgpu port is `v20251002.162335`. Configure a new
`build-count-q2-webgpu` directory with:

```text
cmake -S SOURCE -B SOURCE/build-count-q2-webgpu -G Ninja
  -DCMAKE_TOOLCHAIN_FILE=SDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake
  -DCMAKE_MAKE_PROGRAM=NINJA_EXE -DCMAKE_BUILD_TYPE=Release
  -DBUILD_SHARED_LIBS=OFF -DGGML_WEBGPU=ON -DGGML_WEBGPU_JSPI=ON
  -DGGML_NATIVE=OFF -DGGML_OPENMP=OFF -DGGML_METAL=OFF
  -DGGML_WASM_SINGLE_FILE=ON -DLLAMA_WASM_MEM64=ON
  -DLLAMA_BUILD_COMMON=OFF -DLLAMA_BUILD_TESTS=OFF
  -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_BUILD_TOOLS=OFF
  -DLLAMA_BUILD_SERVER=OFF -DLLAMA_BUILD_MTMD=OFF
  -DLLAMA_OPENSSL=OFF -DWLLAMA_TEST_BACKEND=OFF
cmake --build SOURCE/build-count-q2-webgpu --target wllama --parallel 1
node scripts/qa/package-q2-webgpu-runtime.mjs SOURCE NEW_PRIVATE_OUTPUT
node scripts/qa/serve-q2-webgpu-runtime.mjs PRIVATE_OUTPUT PINNED_QWEN3_06B_FILE 4269
node scripts/qa/serve-q2-webgpu-runtime.mjs PRIVATE_OUTPUT PINNED_QWEN3_06B_FILE 4269 cpu
node scripts/qa/check-wllama-stream-abort.mjs PRIVATE_OUTPUT/wllama-count-q2-webgpu.js
```

The multiline configure command above is schematic: supply the arguments in
one shell invocation, with properly quoted absolute paths. Build concurrency
is intentionally bounded on the development host; it is not an inference
performance setting.

The packager checks both source revisions, all three patch hashes, all modified
source hashes, unexpected tracked edits, key CMake options and native artifact
hashes. It creates a distinctly named bundle in a new private directory. The
receipt describes compilation, not successful model execution. It never uses
the historical CPU artifact receipt to certify a GPU binary.

The loopback server validates the complete pinned 0.6B Q4_0 file hash and the
new native/bundle hashes before serving. Open it only in the existing sidebar
browser. The check records GPU/offload logs, exact prompt counts, real streamed
JSON, first content time, native timing/usage, cancellation and fresh Worker
reload. Stop requires an actual `AbortError`, no continued content and bounded
completion; an unrelated error or failed disposal makes the check fail. Save
the result, stop the loopback server and return to the public app afterward.
Run the GPU and CPU servers sequentially. Both use the same linked binary and
wrapper, with GPU layers set to 99999 and zero respectively. CPU's upstream
`noWebGPU` resource deliberately makes the Worker's adapter request return
null; its resulting log is not evidence that the browser lost WebGPU support.

The stream patch addresses an observed queued-chunk race: the native callback
can enqueue a batch before the consumer aborts. The wrapper suppresses queued
content after abort and drains to the producer's actual cancellation/error,
so the native request is released before the iterator returns. Normal producer
completion after abort raises an error, including the final-chunk race. The
compiled-wrapper unit check covers queued cancellation, unrelated error,
ignored cancellation, final-chunk cancellation and normal content. This is a
controlled producer test, separate from the real browser/model evidence.

This small Q4_0 check exercises whole-runtime integration. It cannot certify
Q2_0 full-model dispatch, original 8B, Bonsai2 9B, mobile memory, thermal
stability, Metal, long conversations or offline cold restart. Keep those
acceptance items separate. Do not package private models or runtime binaries
into Git or deploy them merely because compilation succeeds.

Licenses must be traced to the actual included components. The local
emdawnwebgpu package contains Emscripten MIT/NCSA terms for its C bindings and
Dawn/Tint redistribution terms for C++ bindings. These are separate from the
model's Apache-2.0 license and from the previous WebML runtime's unresolved
redistribution status. Product distribution requires preserving the relevant
notices and completing the linked-component inventory.
