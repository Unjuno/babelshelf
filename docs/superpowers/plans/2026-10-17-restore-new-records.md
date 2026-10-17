# Explicit non-overwriting restore of new records

Problem: any same-ID difference currently blocks every full-state import, including useful new notes on an initialized device. Keep strict Restore as the default. Offer a separate explicit Restore new action only for schema2 conflicts when the merged current-plus-new graph validates and at least one new entry exists. Existing same-ID notes and same-key auxiliary records are kept byte-for-byte; all conflicts stay listed. Imported conflicting versions are not reconciled or silently applied. Keep the source backup.

Compute candidate writes with the existing planner and safety guards, then validate the entire merged canonical graph. Do not fall back to incoming conflicting sources, raw assets, dialogue or receipts. Dependency or path errors disable this mode. Preview pins whole current state; commit recomputes mode and graph in the same three-store transaction, add-only. Preserve schedule quarantine and downloads OFF. Unknown modes and schema1 mode use fail. No model/runtime/network changes.

Verify strict default regression, successful new-only merge keeping notes/settings/runs unchanged, dependency/path refusal, immutability and restored-task guards; native conflict fixture plus one public note, explicit review, Memory lookup/reload and backup equality for every old record. Separate device/offline-process limitations remain.
