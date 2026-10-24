# memory.search

Use for local saved-record search by topic, phrase or clues, including “find what I saved about …” requests. Prefer this over `memory.read` unless the user supplies an exact ID, full path or filename.

Input: `{query: string}`. Execution uses the current canonical host snapshot. Results retain IDs and revisions. No writes, network, installation or permission changes. Guidance is not execution authority.
