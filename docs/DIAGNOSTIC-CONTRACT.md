# Local issue diagnosis

Diagnostics use typed, already-recorded failure states. They do not infer a cause from model names, attachment extensions alone, or generic errors. A diagnosis may offer a direct link to the settings section for the named subsystem; following it does not change selections, download assets, retry a request, or modify stored data.

Current mappings are deliberately narrow:

- `Model not prepared` / `Model not configured` → Text model settings.
- `Analysis not prepared` with an attachment state of `Image text not prepared` or `No text layer · OCR required` → Image text settings.
- `Analysis not prepared` with an attachment state of `Speech to text not prepared` → Speech to text settings.
- Repeated subsystem failures are de-duplicated. Unknown, unsupported, GPU, storage, stale-data, and other errors receive no guessed model repair action.

The diagnosed subsystem is brought into view in Settings > Models while its existing selection remains unchanged. Preparation and model replacement remain explicit user actions. A diagnostic never authorizes model-produced configuration changes or execution. The failure status and its related attachment state are the local evidence; diagnostic classification itself is transient UI state.

This is an initial scoped repair path, not a general health checker. Browser capability probes, device-memory fit, compatibility tests, runtime license validation, and multi-step repair plans are separate unfinished acceptance work.

## Optional local failure log

Settings > Developer contains a separate, opt-in failure log. It is off by default. When enabled, subsequent failed or stopped harness operations append only a bounded operation identifier, timestamp, allowlisted failure code/status, and a fixed category explanation to local browser storage (100 entries). Raw exception strings are never retained in these log entries; they can include arbitrary model/runtime/tool content even when paths and URLs are removed. Reading older schema-1 log entries replaces their message with the fixed explanation and persists that redaction when possible while preserving each entry's ID, time, operation, status and recognized code. Prompts, file names/paths, attachment content, model input/output, URLs, and exception excerpts are excluded from the log and model handoff. Turning logging on is forward-only; earlier events cannot be reconstructed. Turning it off stops future capture; Clear logs removes the saved diagnostic entries. The feature does not gate or change model selection, readiness, or normal use.

The existing Processing history remains a separate operation receipt view. It may contain operation input/result data and is not copied into the diagnostic log. **Review in chat** places the redacted diagnostic entries into the composer as an editable draft; it does not submit the draft or run the model. A diagnosis runs only after the user reviews and sends it. The model can suggest a repair, but does not apply it; any supported settings or memory change still requires the existing review and Save flow.

The Send boundary also fills a diagnostics gap for failures that occur outside a persisted activity (for example, before input commit or while saving the final turn). When opt-in logging is enabled, it appends one fixed `dialogue.turn` entry if no failed/stopped stage receipt was already committed. Only an explicit Stop and the typed activity-receipt persistence failure get specialized categories; all other top-level failures remain `operation_failed`. The thrown message, prompt, attachment names/content and model output are discarded. Failure of this best-effort log write never replaces the original turn error. Existing stage failures are not duplicated.

Model checks report distinct evidence: asset verification checks local bytes; Load checks the selected adapter/runtime can load those assets; an actual generation is only demonstrated by a completed inference. These signals are advisory and never silently replace a model or block a user's selection. Speech and decision assets marked execution-untested remain so until a real inference path is exercised.
