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

Settings > Diagnostics contains a separate, opt-in failure log. It is off by default. When enabled, subsequent failed or stopped harness operations append only the operation name, timestamp, typed status/code, and a short sanitized error message to bounded local browser storage (100 entries). Prompts, file names/paths, attachment content, model input/output, and URLs are excluded. Turning logging on is forward-only; earlier events cannot be reconstructed. Turning it off stops future capture; Clear logs removes the saved diagnostic entries. The feature does not gate or change model selection, readiness, or normal use.

The existing Processing history remains a separate operation receipt view. It may contain operation input/result data and is not copied into the diagnostic log. “Ask model” places the redacted diagnostic entries into the composer for an explicit user-submitted local diagnosis. The model can suggest a repair, but does not apply it; any supported settings or memory change still requires the existing review and Save flow.

Model checks report distinct evidence: asset verification checks local bytes; Load checks the selected adapter/runtime can load those assets; an actual generation is only demonstrated by a completed inference. These signals are advisory and never silently replace a model or block a user's selection. Speech and decision assets marked execution-untested remain so until a real inference path is exercised.
