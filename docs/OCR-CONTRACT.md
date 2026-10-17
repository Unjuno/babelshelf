# Local image text contract

Image text is a separate local OCR capability. It is not general image understanding, a Decision adapter or an omni model. The current adapter uses Tesseract.js 7.0.0 and tesseract.js-core 7.0.0, with English/Japanese integer language data. Settings registration does not imply preparation. The user explicitly prepares the selected language assets; missing or changed bytes fail rather than download during recognition.

## Assets and execution

`design/prototype/src/ocr-manifest.json` pins package versions, runtime byte counts/SHA-256, and the two compressed language files/revisions. Language data totals 4,983,129 bytes for English + Japanese. App-owned worker/core assets are bundled into the verified product shell. `prepare-ocr-runtime.mjs` verifies installed package bytes and copies byte-preserving .bin assets; Vite must not transform these scripts. At execution these verified bytes become typed local Blob URLs. The worker bridge accepts only the pinned OCR protocol, exact local core URL and in-memory language buffers; fetch/XHR and arbitrary imports are denied. No default Tesseract CDN acquisition is allowed. The app owns the Worker immediately and terminates it on Stop, failure, timeout and completion; Blob URLs are released.

PNG/JPEG only: preflight caps the original at 64 megapixels. Browser decoding establishes orientation; processing is uniformly resized to at most 4096 pixels on a side and 8 megapixels. Raw original bytes remain unchanged. Frame zero, browser-decoded orientation and original/processed dimensions are recorded. HEIC/WebP, scanned PDF raster OCR and video-frame understanding are not implemented by this adapter.

## Records, review and source

Read text produces a review, never an automatic knowledge write. Save atomically stores the immutable original record/canonical projection and a separate `Attachments/OCR-ID.md` note. Original ID/revision/hash, processor, language/model pins, exact recognized text, normalized line rectangles and text ranges remain on `ocrText`. Blank recognition cannot be saved. Duplicate/stale Save and withdrawn-original dependencies fail.

Corrections append revisions; first OCR text and regions remain. Only unchanged v1 text with an unambiguous matching quote can narrow a citation to recorded line regions. Edited, unmatched or ambiguous text opens broader original coverage. These are approximate OCR line regions, not guaranteed pixel/semantic alignment. Original bytes, extraction and corrections survive full-state backups; validators reject orphan links, changed pins, impossible ranges/regions and contradictory raw records. Withdrawing the original removes dependent extraction from search evidence and blocks saving against it. No data reset or database version migration is required.

Read/Prepare attempts use the existing on-demand processing ledger. Completion means processing finished, not approval, accurate text or a saved note. Interrupted attempts do not replay. Runtime readiness is established from actual verified assets, never ledger entries.

## Current interaction boundary

The product path supports attach/open PNG or JPEG → Read text → review → Use text → Send with a question. Use text stages the reviewed extraction and keeps the draft unchanged; no knowledge write occurs there. Send atomically persists the original, a separate canonical OCR note and the dialogue reading link, matching TXT/MD import semantics. Explicit Save note remains available. Multiple TXT and reviewed OCR/PDF attachments share current-input grounding. A question is answered from selected excerpts of these files, with bounded history only to clarify intent/format. Unread binary attachments still stop generation; filename metadata never becomes evidence.

The raw image record is eligibility metadata during current OCR grounding; later prose edits to its canonical note are excluded from OCR evidence. Every selected readable file must fit at least one excerpt in the tokenizer budget, otherwise generation refuses. Changed/withdrawn current inputs are checked before and after generation. Explicitly selected earlier dialogue messages take precedence over current attachments. New-note requests are routed normally; attachment-derived capture content is generated from verified excerpts and shown for review, never copied from the planner's invented factual body. See INPUT-READINGS.md.

Scanned PDF pages now share the pinned raster recognizer through the PDF adapter; see PDF-CONTRACT.md. They retain the original PDF/page identity rather than creating an image original. General scene understanding, video frames and unsaved OCR work surviving reload before Send remain pending.

## Licenses and evidence

Separate notices are in `design/prototype/licenses/ocr-*`. Tesseract.js and core packages carry Apache-2.0 notices; the traineddata package wrappers declare MIT while the underlying naptha/tessdata repository supplies Apache-2.0. These are distinct provenance statements, not one blanket runtime license. Upstream sources: https://github.com/naptha/tesseract.js , https://github.com/naptha/tesseract.js-core , https://github.com/naptha/tessdata , https://www.npmjs.com/package/@tesseract.js-data/eng , https://www.npmjs.com/package/@tesseract.js-data/jpn . Bundled worker third-party and wasm-feature-detect notices are retained separately. Full redistribution review of all transitive native/codec components remains a release gate; this work does not publish or deploy.

PC browser recognition is real, but broad accuracy is not established. The English fixture recognized CEDAR-5821 and 9 liters. The Japanese fixture misread part of its first line and introduced spaces; this is recorded as an accuracy limitation, not an acceptance pass for Japanese fidelity. Physical iPhone/Android and whole-device offline process cold starts remain separate gates. See TEST-RESULTS.txt for precise build and test scope.


Unit19: ordinary Send can run this prepared reader directly, saving automatic text as extracted rather than reviewed. Missing preparation never starts a download. Read/Use text/Save note remains available; see INPUT-READINGS.md for atomic import, Stop and current-input scope.
