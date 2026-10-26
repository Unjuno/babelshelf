# Submission application boundary implementation plan

Execution: implement inline using the executing-plans workflow; no delegated agents.

**Goal:** Preserve the accepted UI and canonical data while moving Send execution and transient state out of Prototype.

**Architecture:** A framework-independent controller owns one active attempt, cancellation and typed lifecycle. A submission workflow owns input commit, routing and dispatch; explicit view ports open existing reviews. Existing atomic submission, source checks, tool limits and CAS remain authoritative. No persisted schema migration.

- [x] Test controller overlap, cancellation, failure, review and commit/Stop ordering; observe missing-module failure.
- [x] Implement controller and extract Send workflow with typed ports; keep view adapters in Prototype.
- [x] Test actual local calculation/capture paths and extraction/persistence failure without model fabrication.
- [x] Run focused tests, TypeScript, application regressions and product build; update architecture and evidence.

Deferred: engine replacement, search index redesign, durable lifecycle schema migration and visual changes.
