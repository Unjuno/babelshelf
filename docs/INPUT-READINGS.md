# Reviewed attachments in Input

The accepted Input UI now supports a question with reviewed image/PDF text without first saving a separate note manually. This extends the existing TXT/Markdown import behavior. It does not add sessions or a second conversation UI.

## Review and storage

Read text runs the real prepared local processor. Use text retains the existing draft and other attachments and stages the exact reviewed metadata under the raw attachment ID. It writes no canonical note. Remove discards that pending item; reload before Send does not preserve pending work. Save note remains an explicit alternative.

Send is a durable import action: one transaction checks the expected dialogue revision, original identities, extraction metadata and current original state, then writes new raw originals, separate OCR/PDF text notes and the input turn. Existing originals are reused without copying bytes. Duplicate extraction IDs, conflicts, malformed reading links and withdrawn targets abort the entire transaction. A failed transaction keeps the draft/attachments available. Stopping subsequent inference leaves the successfully imported originals/text and a stopped input turn; it does not silently undo the import.

A dialogue attachment's reading field contains kind, canonical extraction note ID and first revision only. Exact text, processor pins, pages/regions and original hashes remain on the extraction record. Full-state backups retain both; validation rejects cross-file, mismatched kind/version, orphan or forged original links. Historical links remain valid after later correction/withdrawal; those historical references never restore current evidence eligibility.

## Grounding and intent

Current readable attachments include TXT/MD originals and reviewed OCR/PDF derivatives. Retrieval is scoped to those files, with one leading relevant excerpt per file before extra matches. Raw binary-note bodies provide only dependency eligibility and cannot enter the derived-file evidence. All current files must contribute an excerpt within the actual tokenizer budget; failure asks for fewer attachments. Results describe selected excerpts rather than whole-file comprehension. Partial PDF coverage remains recorded and shown in review/pending status.

Bounded dialogue history may clarify what the user means or the requested format, but supplies no additional attachment facts. Old note pins are excluded from this current-input scope. Inputs are revalidated before and after generation; changed/withdrawn evidence fails, including uncited selected files. Exact canonical references let source marks open the correct original image regions or PDF pages.

Natural requests still reach the existing planner. For already reviewed current inputs, a model read/search/chat choice continues through scoped retrieval to an answer rather than stopping at a global search list. Explicit literal search/open commands retain navigation behavior; capture/edit/recall/transform/summary keep their separate paths. This policy follows an actual native failure where a factual attachment question stopped at Found results. Capture requests for a new note use grounded generation from the selected files, discard planner-authored factual content, and present exact generated text/source refs in New file review. Save writes that content without another generation. An explicit selected past user/assistant message retains its original text and citations instead of being replaced by current attachments. Existing-note edits keep their separate Before/After approval; the source-only semantic correction adapter has not gained arbitrary cross-file factual rewriting in this unit.

## Verification scope

Pure metadata fixtures validate links/retrieval and are not OCR or inference evidence. Real IndexedDB tests cover concurrent Send, returned extraction refs for empty Send, all-or-nothing failures, old-dialogue conflict, existing raw reuse, withdrawal and empty-database restore. Native UI and actual Bonsai results are recorded separately in TEST-RESULTS.txt. Broad semantic accuracy, scanned PDFs, video vision and physical/full-process offline acceptance remain separate gates.

Unit18 actual PC evidence: mixed OCR/TXT answer and two current-file citations, empty PDF Send/following summary, exact generated-answer Save, existing PDF raw reuse and server-unavailable tab restart/read/export/restore passed their scoped checks. The requested original-language summary format failed twice with actual4B, including after prompt clarification; correct facts/quotes do not prove instruction/language fidelity. See TEST-RESULTS.txt.
