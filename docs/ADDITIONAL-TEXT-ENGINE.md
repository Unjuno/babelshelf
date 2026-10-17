# Additional local text engine: staged integration

The latest user instruction allows local models other than Bonsai. Existing choices and defaults remain unchanged. No cloud inference, automatic acquisition or runtime supplied by a model is authorized.

## Unit67: asset foundation

The official HuggingFaceTB/SmolLM2-360M-Instruct repository publishes a quantized ONNX graph. `design/prototype/src/onnx-text-manifest.json` pins its model revision, all six asset sizes/SHA-256 values and the installed Transformers.js and ONNX Runtime versions. The model assets total 366,674,624 bytes. The graph itself was downloaded outside the repository and independently verified: 364,564,671 bytes, SHA-256 `57987a3a24dc34ad2cb5e7e566840ccaece095e35a24ae4fc5b3086c7ddd6918`.

The inspected config declares LlamaForCausalLM. The actual tokenizer's chat template was inspected and applied. The intended adapter limits context to 2048 tokens and replies to 768 (normal replies default to 256), irrespective of the larger advertised model limit. This is a lightweight, primarily English candidate; it does not establish multilingual quality or complete the initial model set.

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

## Unit68: second engine connected

The app now routes its existing TextRuntime through TextEngineRouter. Bonsai and validated Qwen35 GGUF custom records retain the existing WebML adapter. The fixed SmolLM2 candidate uses a separate Transformers.js/ONNX Runtime WASM worker, the actual model tokenizer and ChatML template. Only one text backend is active. Active model, model revision, combined HF/ORT runtime revision and context limit are used by the existing pinned inference port. No backend receives storage, tool or knowledge-write authority through this port.

Add model lists SmolLM2 360M (English) without changing default/selected models or silently adding it to a user's library. Import files accepts the six pinned JSON/ONNX files, and explicit network preparation is separately permitted by the canonical connection setting and exact Service Worker URL allowlist. Ordinary inference denies fetch except the packaged WASM/mjs pair. Missing/optional model files return terminal404. No model-supplied runtime, URL or arbitrary ONNX registration is accepted.

The 2048-token total context remains bounded. Normal generation defaults to256 output tokens, while384-token task proposals and768-token rewrite requests are accepted when the measured prompt plus requested output fits. Overflow fails without truncating a proposal and presenting it as complete.

Status reports Files present when only exact sizes were checked. Load and actual runtime reads verify SHA256. Initial preparation uses the same label and the ONNX model's own total asset bytes, without adding unrelated WebML runtime bytes.

Stop terminates the WASM worker and rejects its pending calls, discards loaded identity and never automatically replays. A subsequent explicit Load creates a new worker. A worker fault similarly permits a fresh explicit Load, including switching back to Bonsai. The baseline initialization promise excludes optional cancellable ONNX status so Stop during initial configuration cannot permanently poison later operations. Epoch checks prevent post-Stop continuation after configuration awaits.

### Actual outcome and remaining limit

PC Chrome155 real worker load/generation/unload after a new offline process succeeded. Native product UI registration, local import, offline load, Stop and explicit reload also succeeded. The same native Send path produced Invalid model JSON for a short greeting: this360M candidate is not established as suitable for the harness's structured routing. It remains a lightweight engine integration candidate, not a replacement recommendation or evidence of general conversation, correction, multilingual or scheduled-task quality. The failed turn is retained, and no parser rescue, guessed action or fallback output was added.

General custom ONNX import, additional useful multilingual initial candidates, phone/device acceptance and broad model-independent harness quality remain open. See TEST-RESULTS.txt for exact builds and artifacts.

## Trusted backend registration (Unit90)
TextEngineRouter now owns one registration map for isolated text engines. The existing Transformers/ONNX backend uses it for both fixed models; WebML/Bonsai and validated custom GGUF remain the base backend. An additional app-owned registration supplies a stable engine ID, explicit non-overlapping model IDs, revision/context/runtime metadata and a trusted factory. Construction rejects duplicate identities and incomplete manifests without starting a factory. This is executable app code, never an imported settings/Markdown/model-supplied script. Registration is not a claim of hardware/format/semantic compatibility.

Count/generate/prepare route to the declared owner; unknown IDs fail before an active model is unloaded or preparation starts. Per-active-model manifest identity remains available to TextRuntime budgeting/pinning. Loading another model releases the previous one. Stop terminates/discards each instantiated isolated worker, rejects late results, and never replays. A faulted worker is recreated only on explicit use; switching to the base engine does not call Unload on a dead worker. Existing local preparation checks, defaults and model selectors are unchanged. No unimplemented engine is added to Add model.

LFM normal integration has an explicit remaining dependency: the installed pinned wllama3.8.1 guides/intro-v3.md Migration from v2.0 documents removal of tokenize/detokenize; wllama.d.ts and bundled source expose completion but no public pre-generation tokenizer API. Generation usage counters are not a pre-generation context budget. The diagnostic adapter's actual generation evidence remains valid, but character estimates or private undocumented native calls must not silently replace exact count. A compatible exact template/tokenizer path or supported engine API is needed before normal registration. No model failure or comparison outcome is inferred from this API boundary.

Unit111 adds dedicated native offline local-file import evidence for the fixed SmolLM2 six-asset set, plus a separate browser-process restart retaining selection/presence with no replay. It does not add arbitrary custom ONNX support, new generation quality evidence or a default change. See TEST-RESULTS.txt and scripts/qa/onnx-local-import.mjs.
