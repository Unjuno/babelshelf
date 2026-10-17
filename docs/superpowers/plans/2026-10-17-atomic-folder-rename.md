# Atomic canonical folder rename

Current rename appends note path revisions, then separately enqueues empty-folder metadata. Failure or close can expose a partial operation. Preserve accepted UI, IDs, bodies, sources and old paths; commit both in one notes/settings readwrite transaction. Compare exact affected projected snapshots and subtree membership plus expected stored folder metadata; reject concurrent additions/edits/metadata changes. Recompute path/collision/depth/protection checks inside transaction. Existing canonical data is never reset.

Drain local note/metadata queues, reserve rename synchronously, get the writer's committed expected snapshot, then invoke the atomic operation. Hydrate metadata only after commit so the React effect does not enqueue a second write. Refresh canonical views and update active navigation. Reject double Save/dismiss while saving. No model/network/permission changes.

Verify path/history/source preservation, empty subtree moves, protected roots, depth/collision and stale subtree rejection with pure controls; native browser populated + empty descendants rename/reload/History/backup; actual transaction abort/CAS controls where available. Physical devices remain separate.
