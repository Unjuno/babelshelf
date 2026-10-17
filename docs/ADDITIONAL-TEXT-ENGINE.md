# Additional local text engine: staged integration

The latest user instruction allows local models other than Bonsai. Existing choices and defaults remain unchanged. No cloud inference, automatic acquisition or runtime supplied by a model is authorized.

## Unit67: asset foundation

The official HuggingFaceTB/SmolLM2-360M-Instruct repository publishes a quantized ONNX graph. `design/prototype/src/onnx-text-manifest.json` pins its model revision, all six asset sizes/SHA-256 values and the installed Transformers.js and ONNX Runtime versions. The model assets total 366,674,624 bytes. The graph itself was downloaded outside the repository and independently verified: 364,564,671 bytes, SHA-256 `57987a3a24dc34ad2cb5e7e566840ccaece095e35a24ae4fc5b3086c7ddd6918`.

The inspected config declares LlamaForCausalLM. The actual tokenizer's chat template was inspected and applied. The intended adapter limits context to 2048 tokens and replies to 256, irrespective of the larger advertised model limit. This is a lightweight, primarily English candidate; it does not establish multilingual quality or complete the initial model set.

`pinned-text-assets.ts` is a dependency-injected asset store foundation, not a registered engine. It accepts only pinned manifests, verifies streamed bytes, permits acquisition only in explicit preparation, supports local imports and preserves existing bytes on failed atomic writes. Runtime reads never fetch. Presence status checks sizes only and must never be displayed as verified/execution readiness. Actual reads rehash bytes. The caller must serialize preparation and reads using the shared asset gate and provide a dedicated app-owned OPFS directory.

The license fields describe upstream package declarations: SmolLM2 and Transformers.js Apache-2.0, ONNX Runtime MIT. This does not audit every redistributed artifact and does not change the separate unresolved WebML runtime license status.

## Required next integration

- Add a local-only Transformers.js causal generation worker with exact-path asset access and packaged WASM; deny network fallback.
- Route the existing TextRuntime port to the active registered engine. Include the active engine revision in identity checks, tokenizer counting and cancellation.
- Stop WASM inference by terminating its worker where cooperative interruption cannot run; never replay automatically.
- Add the candidate to Add model and initial preparation only after the adapter is connected. Preserve selected/default models.
- Verify actual browser load, generation, Stop and a new offline process. Node/control tests and downloaded weights are not this evidence.
- General user ONNX models need separate architecture/tokenizer/template validation. An ONNX extension alone does not prove compatibility.

No product UI or usable model catalog entry was added by this foundation unit. Existing model selections and canonical knowledge are untouched.
