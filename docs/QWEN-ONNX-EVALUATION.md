# Qwen2.5 ONNX candidate — Unit71

The latest user direction permits additional local models, without silent choice/default changes. SmolLM2 360M structured transport works but its sample reply was unhelpful. Evaluate a multilingual alternative through the same local TextRuntime rather than add a cloud/provider fallback or model-specific prompt rescue.

## Pinned candidate

- Upstream: Qwen/Qwen2.5-0.5B-Instruct, revision7ae557604adf67be50417f59c2c2f167def9a775. Official model card lists Japanese among29+languages and original model Apache-2.0. These descriptions are not app quality or numerical-equivalence evidence.
- Conversion: onnx-community/Qwen2.5-0.5B-Instruct, revision22942cb7d7ba4cc81bb4673549ca4d4614469b5e. Its model card identifies the upstream model and Transformers.js ONNX purpose. It declares no independent conversion license; retain that absence explicitly. The bundled notice is the original model license, not a claim of separately audited conversion rights or runtime licensing.
- Graph: onnx/model_quantized.onnx,512096557bytes, SHA25641834041ab1b29eff9fc592f1a29a1844133aea35832ea9fa91682be13016100. Actual download independently matched. Six required files total519137612bytes. Weights are outside Git.
- Inspected config: qwen2/Qwen2ForCausalLM. Tokenizer: BPE/ByteLevel, ChatML with an optional tool-template branch. The application passes messages only; model-native tools/remote code are not enabled. Inspect actual rendered system prompt before inference acceptance.
- Engine remains packaged Transformers.js3.8.1 and pinned ONNX Runtime WASM, context2048, normal output256/max768. Installed adapter supports this model family; actual graph compatibility must still be measured.

## Integration contract

An app-owned fixed manifest registry supplies independent stores/IDs/revisions and precise preparation sizes. Unknown model IDs fail; no custom URLs/runtime/ONNX graph registration is enabled. One active ONNX model shares the existing hard-stop client; switching unloads the old model. Prepared reads remain hash-verified/local-only, missing assets terminal404, explicit preparation the only acquisition path. Existing Bonsai and Smol choices/data remain.

First verify real worker import/offline-process reload/generation/unload. Only then connect Add model, canonical preference allowlist, initial preparation and exact acquisition URL allowlist. Test normal Send language/context, source safety and Stop without manufacturing outputs. Preserve failures. No default replacement or general model-quality/device claim from download, schema success or a single greeting.

Primary sources: https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct and https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct. Review redistribution separately before any publishing; this task does not publish or deploy.

## Measured evidence

PC Chrome155 worker test in `outputs/unit71-qwen-worker/evidence.json` passed explicit verified local import, browser close, new offline process, actual load/token count, English and Japanese generation, and unload. Actual outputs included `Hello! How can I assist you today?` and `こんにちは、世界!`. This establishes a bounded engine integration, not normal dialogue/context quality or physical-device acceptance.

The real tokenizer test in `outputs/unit71-qwen-template.json` preserved system/latest messages, counted the actual planner prompt at675 tokens and accepted Japanese/emoji JSON through the structured token filter. This tokenizer-only check is not inference evidence.

Add model, canonical catalog validation, preparation sizing and precise SW acquisition allowlist now include this independent model. Existing defaults remain unchanged. Prototype292 tests, production-shell2 tests, shell29-pin check and protected-runtime28-file check pass. Native Add model/select/Load/Unload passed in `outputs/unit71-qwen-ui-d/evidence.json` after reloading the updated page and awaiting asynchronous canonical selection. Earlier QA failures are retained: old live page catalog after update, unnecessary update wait when already current, and immediate assertion before canonical selection completed. Ordinary Send/context acceptance remains separate.

Normal three-turn Send in a new offline Chrome process on build b68802a2c4a53897 failed (`outputs/unit71-qwen-dialogue/evidence.json`). Hello incorrectly planned knowledge-answer and failed answer JSON; acknowledgement selected nonexistent assistant history index3; follow-up selected inputs without submitted attachments. Strict validators rejected these, no manufactured answer or source/target repair. Answers/context both false. This candidate is connected and can generate locally, but is NOT a useful initial/default recommendation under the current harness. The result does not prove all Qwen sizes or future engines incompatible. Broader model-independent routing/typed-context design remains open; do not repeat model-specific prompt variants as a substitute.
