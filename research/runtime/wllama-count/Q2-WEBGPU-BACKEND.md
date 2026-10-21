# Linked Q2_0 backend checks and registry lifetime

This checks the actual linked ggml WebGPU backend through its public C API.
It includes GPU allocation, tensor views, automatic vector/matrix selection,
graph dispatch and readback. No CPU scheduler or replacement decoder performs
the tested operations. The scalar JavaScript reference is independent of WGSL.
This is not language-model generation or throughput evidence.

Use the separately pinned four-patch source from [Q2-WEBGPU-BUILD.md](Q2-WEBGPU-BUILD.md).
After changing the GPU source, rebuild its archive before linking the probe:

```text
cmake --build SOURCE/build-count-q2-webgpu --target ggml-webgpu --parallel 1
node scripts/qa/build-q2-webgpu-backend-probe.mjs SOURCE EMSDK NEW_PRIVATE_OUTPUT
node scripts/qa/serve-q2-webgpu-backend-probe.mjs PRIVATE_OUTPUT VERIFIED_FIXTURE_DIRECTORY 4270
```

Set the SDK's `EM_CONFIG` before native builds. The fixture directory is the
private earlier `q2-webgpu-final` output, containing `fixtures.json` and its
completed `result.json`. The server checks the exact fixture-bundle hash
against the committed, previously accepted browser receipt, validates each
row hash and checks the new probe artifacts before serving only on loopback.
Raw model-row bytes must remain private and outside the deployed product.
Open and operate the page in the existing sidebar browser, save the receipt,
stop the server and navigate away afterward.

The probe links the same Release WebGPU/CPU/base archives as the separately
built wllama distribution. Its own link uses O1, JSPI/memory64 and a 256MiB
WASM memory ceiling. This difference prevents using it as a performance test
of the full wllama binary. Source and archive hashes are retained in receipts.

The 162 numerical cases cover five controlled K sizes and four actual original
Bonsai8B tensors: token embeddings, output, first attention query and first
FFN down projection. GET_ROWS uses reordered indices; MUL_MAT uses N1/3 and
N5/33, batch counts1/2, row offsets0/1, padded parent rows/input columns, and
shared allocations. K is64/128/4096/12288/14336. The real FFN K is12288.
Rows require exact equality; matrix tolerance is max(1e-3,abs(expected)*1e-5).
The selected original rows are reindexed into five-row local matrices. These
tests do not exercise a complete original vocabulary-sized tensor, original
global row indices or residency of the full2.31GB model.
Recorded sentinels protect the host readback destination, **not every GPU
allocation's padding**. Hardware-specific subgroup-matrix variants remain
unverified on this adapter.

Actual sidebar Chrome155 initially passed all162 numeric cases but repeated
registry lookups returned0/0. The implementation reset `device_count` before
returning its existing live registry. Moving initialization after that early
return preserved1/1, but the added shutdown/reinitialization check then exposed
a second defect: a cached staging buffer belonged to the previous GPU device.
The browser reported a cross-device CopyBufferToBuffer validation error and
the readback differed by0.5. Both failures are retained.

`llama-cpp-webgpu-registry.patch` fixes the common lifetime boundary: retain
the detected count and reuse the existing shared device/queue/resources on
later backend lookups. A backend context still gets its own shader library
and parameter resources. The final patch is SHA
`3fc5632074e3e0908e7b35c4414bf016fef70d619a6be4ae16934239b442b450`;
its source chain starts after the official Q2_0 patch. The final sidebar run
passes162 cases, registry1/1, shutdown/reinitialization and exact subsequent
GET_ROWS readback, with no native validation errors. Real-row maximum error0;
controlled maximum8.343905210495e-5 remains within tolerance.

This does not add or verify device-loss recovery. The native loss callback
does not establish automatic higher-level recovery. A lost device must be
handled by discarding the runtime/Worker; do not retry against the cached lost
device or advertise that recovery as tested. Concurrent live backends,
physical memory reclamation, full8B/9B generation, Safari/mobile execution and
all offline lifecycle paths remain separate acceptance items.

The final full wllama/count runtime was also relinked against the fixed archive.
Its separately recorded small-model GPU regression confirms count/real JSON,
Stop and fresh Worker reload without claiming large-model or speed acceptance.
No product admission, default, knowledge storage or public deployment changed.
