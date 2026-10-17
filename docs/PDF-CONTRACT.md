# Local PDF text and source pages

Explicit **Read text** uses the pinned `pdfjs-dist` 6.4.299 package. The npm tarball integrity is in the prototype lockfile. Its display module, module worker, CMaps, standard fonts and notices are compiled into the app; the production build manifest records every emitted asset's size and SHA-256. Small inlined resources are covered by their containing module hash. PDF processing is loaded on demand, while the verified PWA shell prepares those assets before use. There is no CDN, remote parsing service or missing-asset network fallback.

The [upstream API](https://mozilla.github.io/pdf.js/api/index.html) supplies document parsing, text items, page transforms and rasterization. The application passes verified original bytes, not a document URL. Its binary resource factory accepts only compiled local CMap/font names. XFA and WASM decoding are disabled; document JavaScript, actions, annotations, links and embedded attachments are not executed by this viewer. This is bounded parsing of untrusted input, not a claim that arbitrary PDFs are risk free or fully supported.

## Original, extraction and coverage

The existing immutable original asset keeps the exact PDF bytes, original ID/revision/SHA/name/MIME. Selection and reading are transient. Review shows text-layer-only processing, processed/total page counts, partial status and each empty page as **No text · OCR not prepared**. Explicit Save atomically adds the raw original/projection if needed and a separate Markdown note with `mediaSource` and `pdfText`. The pending attachment retains its ID; after Save it refers to the stored original so Send cannot duplicate that raw write. Cancel makes no knowledge writes.

`pdfText` schema1 pins processor `pdfjs-dist-6.4.299`, the exact original reference, total page count, complete/partial status, extracted body and contiguous page1..N coverage. Page offsets and text-item ranges use UTF-16 code units. The body joins reconstructed page text with two newlines; text items use spaces and the extractor's EOL markers. This is not a lossless textual representation of a PDF content stream. The original file remains the authority for checking layout and extraction errors.

Bounds are the existing32MiB original limit, at most5000 document pages, the first40 processed pages,100000 body code units and10000 text regions per page. A whole page is omitted when the text budget would be exceeded; coverage is partial and never skips ahead. An oversized first page fails. These are processing bounds, not phone memory or latency guarantees. Empty image-only documents cannot be saved as extracted knowledge. OCR, form-value extraction, arbitrary font/layout fidelity, reading order and encrypted/password workflows are not claimed.

The first recognized body and page metadata remain immutable. Direct/model corrections append note revisions; original bytes and first extraction remain. Withdrawing the raw original excludes the extraction and generated descendants from current evidence. It does not purge history or bytes.

## Citations and original preview

Existing canonical source references pin note ID, exact revision, UTF-16 range and quote. For an exactv1 extraction, a unique cited phrase narrows the range to its page and overlapping text-item rectangles. Rectangles are normalized approximate layout bounds, not OCR regions or a guarantee of glyph-perfect alignment. Multiple-page ranges identify the page span and open the first matching page. The viewer rasterizes that actual original page, highlights known regions, and offers Previous/Next/Zoom. It never uses the browser's active PDF viewer or renders user HTML.

An edited or unmatched body has no invented alignment: opening falls back to the original first page with an edited/unavailable label. Invalid/noninteger/out-of-range requested pages fail; no clamping or substitution of a different page is permitted. Structural metadata checks cannot prove that a re-authored/rehashed backup text actually came from its PDF; original-page verification remains available.

## Persistence and restore

The existing notes/runs transaction is used without a DB reset/version migration. Duplicate Save, path/ID conflict, missing/mismatched or withdrawn original abort all writes. Full-state brainpacks retain the raw PDF and extraction/page metadata and validate their identities, first body, coverage and regions. Schema1 note-only imports cannot introduce orphan PDF derivatives. Unknown/mixed audio/PDF or original-asset/derived-record metadata is refused. Restore conflicts remain non-destructive. Future processor upgrades must retain validators for earlier stored processor revisions instead of rewriting their pins.

## Runtime notices and verification

The engine's own package license is Apache-2.0. CMaps and fonts have their own notices; the bundled Liberation notice specifies GPLv2 with font exceptions. All four unmodified notices are retained under `design/prototype/licenses/pdfjs-*` and included in the product shell. Do not label all runtime/font assets Apache-2.0 or use Bonsai's model license for them. Any public redistribution must separately audit font-source/distribution obligations; this work neither publishes nor deploys the package.

Unit14 has actual PC PDF.js/IndexedDB, native app, actual Bonsai4B citation and server-unavailable fresh-tab evidence in TEST-RESULTS.txt. It does not establish physical Android/iPhone behavior, whole-browser-process/OS-network-isolated cold start, general PDF fidelity, OCR accuracy or the entire offline MVP.

Unit18: Review also offers Use text to stage the extraction with the current question; Send atomically imports raw/text/dialogue and grounds current-input answers in these files. Partial coverage and exact page source remain. See INPUT-READINGS.md. Scanned PDF OCR is still pending.


Unit19: ordinary Send can extract the bundled PDF text layer directly before atomic import; automatic output is extracted, not human-reviewed. Empty text reports OCR required. Review remains optional through explicit Read text. See INPUT-READINGS.md.

## Prepared local OCR for scanned pages

The current reader first extracts each page's text layer. If that reconstructed text is empty and the selected Tesseract adapter/language data is already verified, it renders the SAME original PDF page and recognizes that raster locally. This is wired to explicit Read text and ordinary Send. It never downloads missing OCR data or treats text-layer presence as general image understanding. A page with a partial/inaccurate text layer is currently kept as that text layer; graphics and text missing from that layer are not independently recognized. Without prepared OCR, empty pages retain their explicit no-text state. An OCR error fails the attempt instead of silently skipping the failed page or inventing its contents.

Rasterization uses PDF.js at up to2.5x page scale, bounded to2000px width/2800px height. Pages run sequentially within the existing40page/100000UTF16 body budget; canvases and OCR workers are released per page. Page render cancellation and OCR worker termination share the caller's Stop signal. Browser PNG encoding itself may finish after Stop, but its result is discarded. These bounds are not physical-phone memory/latency guarantees.

New mixed/scanned extractions use `pdfText` schema2 with the same PDF processor and immutable PDF `original` identity. Each recognized page additionally pins `ocr.processor`, exact language/model-file revisions/hashes and raster width/height. The page's text and normalized rectangles remain mapped to that page, never to a fabricated image original. Schema1 text-layer extractions remain valid and unchanged; schema1 may not contain OCR metadata. Schema2 must include at least one OCR page and validates the exact supported pins and size/region bounds. Backup/restore uses the same validators and retains all original bytes and page provenance.

Review identifies OCR pages and their recognized text; automatic Send calls it extracted, never reviewed. Read receipts include requested OCR policy and per-page actual OCR pins. Evidence labels distinguish recognized page text and possible OCR errors, including pages with no extracted text. Exact-v1 citations open the original PDF page with approximate OCR line regions and an OCR label; edits retain the existing no-alignment fallback. Complete/partial still denotes processed page coverage, not complete visual/textual comprehension or recognition accuracy. Earlier paragraphs describing OCR as unprepared/pending are historical Unit14/18/19 boundaries, superseded only by this prepared empty-page fallback.
