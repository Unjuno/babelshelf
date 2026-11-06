# Execution outcomes and model acquisition implementation plan

**Goal:** Distinguish actual outcomes from lifecycle completion and centralize model acquisition without changing the accepted UI or stored schema.

**Architecture:** Host-owned typed outcomes describe answer/import/review/partial/preparation needs. A stateless model policy service coordinates the existing engine clients and inference leases. Automatic operations verify local assets only; explicit preparation retains the user's permission boundary.

- [x] Observe failing outcome and acquisition-policy tests before implementing the contracts.
- [x] Integrate Text/Decision automatic acquisition, reader release and explicit Load; remove the obsolete Text-only preparation helper.
- [x] Ensure chat and generated capture use the common acquisition policy, including paths which previously reached answer generation directly.
- [x] Extract scheduled answering from the UI and retain its read-only scope.
- [x] Verify regressions/build and sidebar normal use, preserving local data across updates.
- [x] Update architecture and evidence, then commit on the existing branch.

Next increments: durable review recovery, unified configuration activation snapshots and incremental Memory indexing. These require separate additive storage designs; this increment does not change stored dialogue/history schemas or promise background PWA execution.
