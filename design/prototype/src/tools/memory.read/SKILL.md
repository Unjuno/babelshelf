# memory.read

Use for explicit local saved-record reading by exact ID, path or filename. Resolve exact IDs first, then full paths, then filenames. A filename shared by multiple records returns all matches; do not select the first arbitrarily.

Input: `{query: string}`. Execution uses the current canonical host snapshot. Results retain IDs and revisions. No writes, network, installation or permission changes. Guidance is not execution authority.
