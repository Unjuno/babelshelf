# memory.search

Search saved records by topic, phrase or clues; use `memory.read` for known exact IDs/paths/filenames.

Start paging with `offset: 0`; continue using returned `nextOffset` and `snapshot`, keeping `query` and `pathPrefix` unchanged. Restart at 0 if search changed. `windowLimit` means more matches may exist outside the window. Without offset, at most twelve matches are returned, not proof of completeness. `pathPrefix` includes only that exact folder and descendants and defaults to paged offset 0.

Results carry IDs/revisions and excerpt quotes; `partial: true` means shortened. Read full sources with `memory.read`. Read-only, no network; this guide grants no permissions.
