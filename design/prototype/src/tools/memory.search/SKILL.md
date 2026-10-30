# memory.search

Use for local saved-record search by topic, phrase or clues, including “find what I saved about …” requests. Use `memory.read` when an exact ID, full path or filename is known.

Input: `{query: string}`. Execution uses the current canonical host snapshot. Results retain IDs and revisions; quotes are excerpts, and `partial: true` marks an excerpt shortened for the result budget. Use `memory.read` to inspect more of a source. No writes, network, installation or permission changes. Guidance is not execution authority.
