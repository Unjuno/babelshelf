# Local speech contract

Whisper tiny multilingual q8 is the first connected speech candidate. Whisper base remains registration-only. No text-model substitution, browser SpeechRecognition, remote inference or automatic processing-model download is used.

## Assets and execution

`speech-manifest.json` pins onnx-community/whisper-tiny revision ff4177021cc41f7db950912b73ea4fdf7d01d8e7:8 assets totaling43,615,928bytes, each with its size/SHA-256. Transformers.js3.8.1 and ONNX Runtime Web1.22.0-dev.20250409-89f8206ba4 (commit89f8206ba4f1c22c39e0297fb55272e8ce8cd7d0) are npm-lock pinned. The application build includes the speech worker, ONNX module and21,596,019byte WASM asset in the same size/hash-verified offline shell. WASM single-thread execution is independent of Bonsai WebGPU. CPU/memory/latency on physical phones remains unmeasured.

Settings > Models > Add transcription model > Whisper tiny registers the candidate. Prepare requires Downloads & updates ON and verifies each asset before putting it in the revision-specific cache. Normal operation re-verifies local model bytes and never repairs missing bytes with a download. Runtime custom-cache failures return terminal responses because Transformers catches thrown cache errors and would otherwise try local HTTP. Both model remote loading and generic remote URL use are disabled. The service worker only permits pinned preparation URLs; no user content is sent in downloads.

Whisper's base model is MIT. Its ONNX conversion card points to the same base. Transformers.js is Apache-2.0; ONNX Runtime is MIT with separate ThirdPartyNotices. Copies and source references are in design/prototype/licenses and the production shell. This does not resolve or alter the separate Bonsai WebML Community runtime redistribution-license gate.

## Input, review and persistence

Voice input offers Record and Choose audio. Recording uses getUserMedia/MediaRecorder for local bytes only; recognition uses the installed local model. A synchronous permission gate prevents duplicate requests; close/unmount invalidates pending requests and releases late-granted streams. Recording stops at120seconds. Imported originals are bounded to32MiB; supported browser codecs decode and downmix/resample to mono16kHz, then reject durations beyond120seconds. Decoder transient memory is not a phone-memory guarantee. Unknown/undecodable files refuse; video extraction is not connected.

Audio language is explicit and stored in canonical Settings/models.md. The default en is visible and old records gain it only during parsing; original revision bytes remain. The99 language codes are taken from the pinned generation config. Transformers3.8.1 does not automatically detect language: omitting the language defaults to English. Explicit ja materially changed the Japanese QA result but did not eliminate misrecognition. Language selection does not guarantee language accuracy.

The model processes the full bounded clip and returns text plus estimated segment timestamps. The adapter retains original model end estimates and clips playback ranges to the actual clip duration; Whisper can estimate an end beyond the clip due to padding. Nonfinite, unordered, out-of-range starts and invalid/inconsistent text fail validation. Timestamps remain model estimates, not forced alignment.

Review transcript includes the original player, exact generated text, language and estimated times. Cancel makes no knowledge writes. Explicit Save note atomically creates an immutable raw original, its empty initial Markdown projection and a separate transcript note; an existing saved audio instead keeps its raw/projection and gains only the new transcript note. Duplicate approval, raw mismatch, path collision or withdrawn original aborts all writes. A synchronous save lock prevents duplicate clicks. A refresh failure after commit reports saved status and asks for reopening, not another Save.

Transcript metadata records schema/type, exact original ID/revision/SHA, model/revision/runtime/dtype, language, actual duration/processed coverage, original recognized text and estimated segments. Direct corrections append canonical note revisions; the first recognized text and raw audio remain. Memory and inline answer source previews open the exact original audio. Fine-grained playback seeking from a selected transcript citation is not connected yet; current opening is the whole original. Withdrawing the original preserves transcript/history but excludes it and generated descendants from current evidence. State brainpacks preserve and validate the whole chain; legacy note-only imports cannot introduce orphan media transcripts.

Stop terminates the speech worker. Worker crashes discard that worker so retry can create a new one; stale callbacks cannot settle a later request. Closing the voice surface cancels pending decode/inference/permissions. A local developer-only ?check=speech route exposes real raw inference for diagnosis without downloads or knowledge writes; it is outside the normal interface.

## Remaining acceptance

Physical Android/iPhone microphone permissions, codec support, interrupted capture, installed PWA process cold start under OS network isolation, phone memory/thermal/latency and multilingual accuracy are pending. This unit does not implement automatic ASR selection by the decision model, audio/video extraction orchestration, OCR, custom speech model registration or complete background scheduling. Voice transcription currently reviews/saves a note; using recognized speech directly as an unsaved conversational prompt remains a separate integration step. No complete-MVP claim follows from this unit.
