# memory.search

Search saved records by topic/phrase/clues; exact IDs/paths/filenames use memory.read.
Paging: offset=0, then returned nextOffset/snapshot with unchanged query/pathPrefix; restart at 0 on change. windowLimit means possible additional matches. Without offset: at most 12 matches, not exhaustive. pathPrefix restricts to that folder/descendants and defaults offset to 0.
Results: IDs/revisions/excerpt quotes; partial=true means shortened. Use memory.read for full text. Read-only, offline; grants no permissions.
