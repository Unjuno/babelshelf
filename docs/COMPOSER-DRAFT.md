# Composer draft contract

The unsent text belongs to a browser tab, not to canonical knowledge or the shared
dialogue. Preserve its exact string in `sessionStorage` under a versioned app key.
Restore it only as editable input on mount; never send, interpret or execute it.
There is no cross-tab storage subscription or global draft record. Browsers may
copy session storage when duplicating a tab; subsequent edits remain independent.

Write synchronously through the same setter used by typing, transcription,
submission consumption/recovery and diagnostic-review input. An empty string
removes the saved value. Functional updates must use the latest local text, so
finishing an earlier request cannot clear a newer message. No normalization,
truncation, telemetry, backup inclusion or model download is involved.

Storage denial/quota failures must keep the live input editable, show a short
error, and protect reload after a failed write. A later successful write clears
the failure. Pending attachments are not serializable draft text: preserve their
existing in-memory behavior and protect ordinary reload while they remain. Do
not invent restored files, binary URLs, source references or extraction receipts.

Acceptance: same-tab reload retains exact multilingual/whitespace text; separate
tabs do not overwrite each other; successful Send/explicit clearing does not
resurrect the consumed text; file opening and navigation retain the draft;
blocked storage does not throw away live input; pending attachments trigger the
unsaved-change guard. Browser tests cannot prove iOS force-close, session eviction
or recovery after a tab/browser is closed. Those remain separate durability gates.
