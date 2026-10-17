# User supplied models and local engine adapters

Latest user direction: users may import their own trained models. Local execution remains the default; no provider change or external inference is authorized. Models are data, not executable plugins. Keep the current accepted UI and default Bonsai4B selection.

## Structure

The harness consumes the common text port. An engine catalog describes app-owned adapters and their actual roles/formats; it does not install code. A model record pins engine ID, role, weight bytes/SHA256, file-format metadata and effective context capacity. Runtime code/revision/license come from the app-owned engine, never from a model package. Tokenizer/chat template and media preprocessing are model assets with their own compatibility checks. ONNX and GGUF are containers, not universal interoperability promises.

## Import lifecycle and trust

Add model -> local file selection -> bounded metadata inspection -> engine/asset review -> explicit import and hash verification -> registered selection -> actual device load/test. Inspection is not execution/readiness. Existing built-ins and record histories remain. Registration/selection is canonical data; weights/runtime are separate verified local assets excluded from state brainpacks. Restore cannot manufacture readiness. File/model text never grants network, knowledge writes or arbitrary script execution.

The first custom execution path will reuse the existing pinned WebML Qwen3.5 text worker for structurally eligible GGUFs. It cannot claim all GGUF architectures, quantizations or fine-tunes work. Additional app-owned engines can be added without changing harness/storage authority. Existing D1, Whisper and OCR adapters remain independent role-specific engines; their current fixed graphs/assets do not imply arbitrary custom ONNX support.

## Implementation sequence and acceptance

1. Implement shared engine descriptors and bounded GGUF metadata/tensor-table inspection. Reject malformed/truncated/duplicate/oversized counts; never read a multiGB model wholesale or execute its strings. Test real existing GGUF separately from synthetic parser controls.
2. Add strict declarative custom model records and canonical model-preference integration, preserving old JSON/revisions. Validate backup links without importing asset code or readiness claims.
3. Connect explicit local import, worker manifest registration, prepared-only load and stable inference pins. The worker must independently validate custom metadata/bytes and retain the fixed runtime/fetch deny policy. No custom remote acquisition.
4. Add local model entry/review to existing Add model sheets, same cancellation/storage gates; prove registration/restart/local load/new generation/Stop through actual product. Keep unsupported cases explicit and no disconnected Load buttons.
5. Add further general-purpose engine adapters only with pinned runtime/license/assets, model-specific tokenizer/template/preprocessing support and actual execution evidence. No automatic cloud/PC fallback.

This is an architectural extension in progress. Step1 alone is not a usable custom-model feature. A parser or catalog does not certify numerical compatibility, device capacity or training quality.

## Unit59 foundation evidence

Bounded GGUF v3 inspection and strict declarative local-model records are implemented. The first16MiB prefix may contain initial payload bytes but payload is not interpreted. Known F32 and Prism PTQ1_0 (type143,128elements/28bytes) tensor extents are checked; unknown layouts remain ineligible. Structural eligibility is not numerical compatibility. Hashing streams bytes with bounded task yields, delivered-abort checks and pending-read cancellation/reader cleanup.

Node tests cover malformed/truncated tables and payloads, strict records, exact hashes and both queued-Stop/pending-read cancellation. Existing949549920byte official4B file independently inspected and hashed to manifestSHA256; this is file inspection evidence only. Canonical preferences, local import, worker integration and product UI remain outstanding. Current accepted product build is unchanged.

## Unit60 canonical registry

Preferences/backup now preserve validated customModels with legacy read projection and append-only settings revisions. Registration declarations do not import files or set readiness. Model-proposed patches cannot change registries/libraries. Worker/UI local import and execution remain next; current UI is unchanged. Native PC regression on product36a41e8120bc9759 passed three separate Chrome processes, including offline boot, capture/import/search/direct correction/history and conflict/identical restore. This regression did not execute a custom model.
