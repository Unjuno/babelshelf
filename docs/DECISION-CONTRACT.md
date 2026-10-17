# Local text decisions

The optional Decision role is separate from Bonsai text generation. Registration in Models is not preparation or runtime readiness. Only Open d1 Omni 600M currently has a bounded text adapter; the 3B catalog entry remains unavailable. Image/audio encoders are not installed by preparing the text graph. Decision outputs cannot read media by implication, generate answers or authorize edits.

## Assets and licensing

`design/prototype/src/decision-manifest.json` pins original LiquidAI/d1-omni-600M revision 02b55d7076f15129e59ab3f94783f32c4b088674 and onnx-community ONNX conversion revision 4ebc1b97bf1477485371c79d1cf8d5e4e8eebfa0. Six text/config/tokenizer/license files total 411,075,809 bytes. Model and adapted prompt/readout code retain LFM Open License 1.0, including its commercial conditions; this is not Apache-2.0. Full license is retained in prototype/licenses. Isolated ONNX Runtime Web 1.31.0-dev.20260914-8d85527a0 is separately MIT with third-party notices. Existing speech runtime stays unchanged. Published open-jev 0.1.2 was inspected and does not support this model configuration; no substitute model is used.

The current WebGPU entry requires its native asyncify mjs/WASM pair. Mixing the new entry with its JSEP pair produced an actual PC `webgpuInit is not a function` initialization failure. All three selected runtime files have exact installed-package size/SHA pins; the product shell separately verifies emitted bundles and runtime assets.

## Local lifecycle

Prepare requires explicit Downloads ON and fetches only revision-pinned URLs without credentials. OPFS `babelshelf-decision-v1` stores verified files under their SHA-256. Streaming hash validation precedes load, and writes commit only after count/hash verification. Stop before replacement cannot turn into a cache miss/download. Readers are cancelled/released; failed downloads abort atomic writers. Status, load and classify never repair missing assets over the network. The worker restricts normal fetch to bundled runtime assets, served through the verified app cache.

Stop during preparation requests cleanup and gates competing commands until acknowledgement; a 2.5-second watchdog terminates a stuck worker. This graceful abort preserves any loaded session. Stop during load/inference terminates the worker; crashes, disposal and postMessage failures invalidate Loaded. Unload releases the session. Historical asset receipts do not establish current readiness. Preparation/load/unload use the on-demand processing ledger with manifest provenance.

## Typed protocol and limits

The original reserved tokenizer markers and calibrated choice/score/binary readouts are checked. Caller delimiters are escaped. Questions have finite bounded options and no arbitrary executable action. The product rejects excessive input/options rather than silently truncating their meaning; its initial input cap is 2,048 tokens within the model's 16,384-token architecture. Exact text graph inputs include prefix_len=0 and masked option positions. Inference tensors are disposed even on failure. Tokenizer/protocol fixture tests are not model accuracy evidence.

The isolated `?check=decision` diagnostic can exercise real prepared local inference without knowledge writes or downloads. It does not replace ordinary-input acceptance. Chat routing remains on the existing Bonsai harness until actual D1 behavior and context/source invariants have been verified. Physical Android/iPhone, all-process offline restart, language accuracy and resource limits remain separate acceptance gates.
