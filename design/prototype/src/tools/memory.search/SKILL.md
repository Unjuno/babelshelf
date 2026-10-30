# memory.search

Use for local saved-record search by topic, phrase or clues, including “find what I saved about …” requests. Use `memory.read` when an exact ID, full path or filename is known.

Input: `{query: string, offset?: integer, limit?: integer, snapshot?: string}`. To inspect multiple pages, begin with `offset: 0`. When `nextOffset` is not null, call again using that offset, the same query and returned `snapshot`. If the search changed, start again at offset 0. `windowLimit` means further results are not available through this search window. Without offset, the legacy result is limited to twelve matches and does not establish completeness. Results retain IDs and revisions; quotes are excerpts, and `partial: true` marks an excerpt shortened for the result budget. Use `memory.read` to inspect more of a source. No writes, network, installation or permission changes. Guidance is not execution authority.

To search a folder and its descendants, include `pathPrefix`; the first page starts at offset 0 when omitted. Keep the same `pathPrefix`, query and snapshot on later pages. Use the exact folder path; sibling folder names are not included.
