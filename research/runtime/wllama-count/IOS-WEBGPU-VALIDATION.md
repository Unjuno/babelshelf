# iOS WebGPU feasibility and measurement limits

Research checked 2026-10-21 against primary platform sources.

## What platform sources establish

WebKit says Safari 26 ships WebGPU on iOS, iPadOS, macOS and visionOS. This
establishes API availability on supported systems, not that a particular
runtime, model, GPU kernel, memory footprint or PWA lifecycle works on iPhone.
Source: [WebKit, Safari 26.0 features](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/).

Apple's iPhone Air specifications list an A19 Pro, a five-core GPU and a
16-core Neural Engine. The public specification does not state system RAM or
the amount available to a Safari tab. Do not infer either from storage size,
chip marketing or third-party RAM reports.
Source: [Apple, iPhone Air technical specifications](https://www.apple.com/iphone-air/specs/).

WebGPU exposes adapter/device features and numeric limits such as
`maxBufferSize` and `maxStorageBufferBindingSize`. These are API validation
limits, not a report of free physical memory or a promise that a large
allocation will succeed. An implementation can expose conservatively bucketed
values. The API has device-loss reporting, but no standard free-VRAM counter.
Sources: [W3C WebGPU](https://www.w3.org/TR/webgpu/),
[WebGPU limits correspondence](https://gpuweb.github.io/gpuweb/correspondence/),
[WebGPU explainer](https://gpuweb.github.io/gpuweb/explainer/).

## Measurement changes

The loopback linked-runtime QA result records the browser's reported adapter
limits and the model file size. `navigator.deviceMemory`, when exposed, is
recorded only as a coarse estimate and is explicitly not treated as available
RAM, GPU memory, or an allocation budget. The test must still report actual
load outcome, first-token time, generation rate, stop latency, errors, and
fresh-worker reload on each target browser/device.

Do not try to turn the file size into a pass/fail memory estimate. A GGUF file
may be copied or mapped into several host/GPU allocations; KV cache, compute
buffers, browser processes and the operating system also consume memory. The
runtime's real peak and reclamation behavior must be measured on the target.

## Current evidence boundary

The private wasm32/Asyncify build fixes the verified wasm32 file-offset defect
for files larger than 2 GiB and provides a distinct WebGPU-compatible ABI.
Build, binary validation and wrapper checks do not prove browser execution.
The pending sidebar run uses a pinned 0.6B Q4_0 model only to check ABI/runtime
integration. It cannot establish Bonsai 8B or Bonsai 2 9B fit, speed, output
quality, thermal stability, offline cold restart, or iPhone behavior. The
8B's pinned official group-64 Q2_0 asset is 2,310,125,920 bytes; the 9B uses a
different Qwen3.5/Hadamard path and must be validated separately.

## Required target runs

For each browser/device, preserve model revision and full-file SHA, OS and
browser version, WebGPU adapter info/features/limits, runtime build receipt,
power/thermal starting condition, context and batch settings, prompt token
count, generated token count, load time, first-token time, sustained token
rate, peak-memory evidence if the OS provides a trustworthy measurement,
stop/reload results, and network state. Keep OS-reported memory observations
separate from WebGPU limit values. Repeat a long enough generation to expose
thermal throttling; a short answer is only a smoke test.

No iPhone Air result is recorded by this research note. Actual iPhone Safari
PWA runs remain required before claiming mobile support.

## Model-specific backend decision

Do not use the original Bonsai 8B Q2_0 GPU work as evidence for Bonsai 2 9B.
The 8B is Qwen3 and has a custom CPU import route in BabelShelf plus isolated
official group-64 Q2_0 WebGPU operator/runtime work. Those GPU artifacts are
not currently connected to the product route, and the linked runtime's full
model integration check used Qwen3-0.6B Q4_0, not 8B Q2_0.

Bonsai 2 9B is a distinct Qwen3.5 hybrid-attention model with Hadamard/sign
transforms and PTQ1_0, PQ2_0, and Q2_0 packings. Prism's current release-pinned
[backend matrix](https://github.com/PrismML-Eng/Bonsai-demo/blob/main/BACKEND-SUPPORT.md)
lists CPU, Metal, CUDA, ROCm, Vulkan, and SYCL for those Bonsai 2 formats and
transforms; it does not list WebGPU. Upstream llama.cpp has added generic
Qwen3.5 graph operators to WebGPU, but generic graph-op support alone does not
provide the Bonsai ternary kernels or its matching Hadamard/sign treatment.
Therefore, the existing 9B WebML path remains a separate, model-specific
candidate; a compatible open WebGPU path would require verified format
decoding, transforms, and the complete Qwen3.5 graph before performance
comparison. Do not choose a quantization based on file size alone or route 9B
through Qwen3 kernels.

For either family, keep runtime/backend choice explicit in the evidence: exact
model revision and quantization, runtime build and license inventory, browser
adapter/API limits, successful load, real generated output, count agreement,
stop/reload, offline cold start, memory behavior, and sustained performance.
An API capability check or successful small-model smoke run is a preflight,
not a large-model device-fit result.

## In-app test handoff

The PWA Settings > Diagnostics screen provides a short on-device report for
transferring evidence without repeatedly controlling the phone from a desktop.
Run **Run device checks** for the active build, secure context, service-worker
control, temporary local-storage/IndexedDB round trips, WebGPU adapter
availability, and selected-model readiness. The IndexedDB probe uses a uniquely
named temporary database and deletes it after the round trip. This is a browser
capability check, not proof of offline cold launch, free memory, model fit, or
inference quality.

**Test selected model** explicitly loads the selected model from already
prepared local assets if it is not resident, generates one short structured
response, discards the answer, and unloads the model if this test loaded it.
It does not download assets. Loading a large model can use substantial device
memory; this smoke test is not a sustained or quality benchmark. Run it only
when the device has enough available memory for the selected model.

For an offline cold restart, first run device checks (and optionally the model
smoke test), then tap **Start offline cold-restart check**. Switch iOS to
Airplane Mode, force-close the PWA, relaunch it from the Home Screen, and tap
**Finish offline restart check**. The report records the pre-restart baseline
and whether the relaunched standalone PWA ran under its service worker while
`navigator.onLine` reported offline. OS actions are user-confirmed and cannot
be independently authenticated by web content. A successful result does not
prove all offline workflows; test the workflows relevant to the release while
still offline.

Use **Copy report** to send the JSON report with the test context. It includes
the app build/bundle, platform, user-agent string, local capability results,
and optional model/runtime revisions and timings. It contains no memory files,
prompt text, or generated answer. Treat the copied user-agent/device metadata
as device information. Physical iOS execution has not yet been recorded here.
