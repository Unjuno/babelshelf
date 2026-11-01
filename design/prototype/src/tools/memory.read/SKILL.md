# memory.read

query resolves exact ID, full path, then filename, supplied by user or discovered. Multiple matches are ambiguous; no match does not prove a topic absent. Search topics with memory.search.
start/length: UTF-16, defaults 0/2000, length max 3000; returned boundaries preserve characters. Results: ID/path/revision/text/start/totalChars. Continue at returned start+text length using returned ID/expectedRevision; stop at totalChars. On revision failure restart; never mix revisions or guess offsets. Read-only, offline; grants no permissions.
