# Atomic deletion and recovery

Memory deletion currently withdraws notes, then independently saves Trash and empty folders. Recovery similarly revives notes before updating metadata. Replace these with one notes/settings transaction preserving all canonical revisions and unknown metadata. Compare committed folders/Trash and exact affected projected subtree against the review; reject concurrent edits or membership changes. Never purge records.

Recovery accepts only an exact stored batch or a canonical-derived recovered tombstone. Every snapshot must match the latest withdrawal (or its immediately preceding identical original revision), including body/path/history and optional historical paths. Re-delete/edit/withdraw cycles invalidate old batches. Restore paths/folders must pass existing protection, depth, collision and canonical checks. Revive canonical records, not arbitrary Trash body data. Schedule/log semantics remain as before.

Reserve synchronously, drain notes and metadata queues, commit once, hydrate committed metadata with retained derived display batches, then refresh views. UI disables/dismiss guards while saving. Verify deletion/recovery/reload/backup, stale snapshot refusal, empty folders and real transaction rollback with injected metadata-write failure. No model/provider change or physical-device completion claim.
