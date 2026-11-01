# memory.read

Read a current record by exact ID, full path or filename (resolved in that order). Use only user-supplied or discovered targets; use `memory.search` for topics. Multiple filename matches remain ambiguous. No match does not prove a topic absent.

`query` selects the record. `start` and `length` are UTF-16 offsets, default 0/2000, maximum length 3000. Results give ID, path, revision, text, start and totalChars; boundaries preserve whole characters. Continue at returned start + text length, with returned ID and `expectedRevision`. Restart on revision failure; never combine revisions or guess offsets. Stop at totalChars. Read-only, no network; this guide grants no permissions.
