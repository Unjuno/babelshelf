# memory.list

List the immediate files and folders in a Memory path. Start with an empty path to inspect the top level, then follow returned folder paths. Use the returned file ID with `memory.read` to inspect exact content. Results are paged and contain paths, IDs, and versions, not file bodies.

This is a read-only view of BabelShelf's IndexedDB-backed notes and folder metadata. It is not an operating-system filesystem and does not create, rename, or delete anything.
