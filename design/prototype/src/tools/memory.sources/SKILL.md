# memory.sources

Find direct sources using a saved note's id/revision from search/read. Page via returned nextOffset/snapshot; restart on change. Reduce limit if oversized. windowLimit means more sources beyond the window.
Items: original path/revision/range and current/changed/removed/unavailable status. Metadata is NOT source text or a citation. Inspect current originals with memory.read; never present old/removed revisions as current. Read-only, offline.
