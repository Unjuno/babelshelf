# Local issue diagnosis

Diagnostics use typed, already-recorded failure states. They do not infer a cause from model names, attachment extensions alone, or generic errors. A diagnosis may offer a direct link to the settings section for the named subsystem; following it does not change selections, download assets, retry a request, or modify stored data.

Current mappings are deliberately narrow:

- `Model not prepared` / `Model not configured` → Text model settings.
- `Analysis not prepared` with an attachment state of `Image text not prepared` or `No text layer · OCR required` → Image text settings.
- `Analysis not prepared` with an attachment state of `Speech to text not prepared` → Speech to text settings.
- Repeated subsystem failures are de-duplicated. Unknown, unsupported, GPU, storage, stale-data, and other errors receive no guessed model repair action.

The diagnosed subsystem is brought into view in Settings > Models while its existing selection remains unchanged. Preparation and model replacement remain explicit user actions. A diagnostic never authorizes model-produced configuration changes or execution. The failure status and its related attachment state are the local evidence; diagnostic classification itself is transient UI state.

This is an initial scoped repair path, not a general health checker. Browser capability probes, device-memory fit, compatibility tests, runtime license validation, and multi-step repair plans are separate unfinished acceptance work.
