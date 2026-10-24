# memory.read

Use only when the user identifies a saved record by exact ID, full path or filename, or asks to open/read a known file. Resolve exact IDs first, then full paths, then filenames. A filename shared by multiple records returns all matches; do not select the first arbitrarily. For a topic, phrase, clue or “find what I saved about …” request, use `memory.search` first. An empty exact read means only that the ID/path/filename did not match; it does not mean the topic is absent.

Input: `{query: string}`. Execution uses the current canonical host snapshot. Results retain IDs and revisions. No writes, network, installation or permission changes. Guidance is not execution authority.
