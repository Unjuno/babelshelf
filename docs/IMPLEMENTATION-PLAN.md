# Integration plan — 2026-10-17

## Completed and preserved

- Baseline PWA has path-aware immutable revisions, path/collision validation, literal capture/search/read routes and local file exchange infrastructure.
- Accepted interactive UI is committed in design/prototype/, with its own dependency lock and protected device runtime. It is a design harness, not the PWA persistence layer.
- Accepted decisions are consolidated in PRODUCT-SPEC.md. Old chronological iterations are not acceptance criteria.
- Baseline Node/static/Markdown seed checks and prototype helper/build checks are listed in TEST-RESULTS.txt.

## Next: one persisted vertical flow

1. Define an adapter from the accepted UI to baseline records. Preserve old IndexedDB schema/data, IDs, references and paths. Map Home display separately from storage. Add an explicit non-destructive path-migration plan if canonical roots change.
2. Implement capture -> persistent save -> retrieve -> original -> explicit correction -> retained revision -> local backup/restore in the accepted UI. Use existing core APIs where valid; no duplicate in-memory knowledge store as the final implementation.
3. Add exact authorized tool patches with expected revisions, bounded field/path schemas, receipts, conflict handling and revision-based undo. Add tests for stale/ambiguous/unauthorized edits.
4. Define typed schedule, rule, event and execution-history records; dedicated views derive from those records. Do not use filenames as execution authority. Leave execution disabled until recurrence/timezone/missed-run/idempotency and platform behavior are established.
5. Validate Bonsai runtime compatibility/licenses/assets, actual generation/stop and resource limits. Evaluate Open d1 independently as a decision candidate, including numerical/preprocessing/decision-head support and multilingual tasks. Do not switch to cloud/LAN/PC inference.
6. Verify new UI on real browsers with IME, enlarged text, touch, source links, import, correction, history and restore conflicts. Then test prepared assets after network cutoff and actual PWA/device restart.
7. Record physical iPhone/Android results separately. Deploy only on a new explicit request.

## Completion boundary

A passing UI build or a static sample answer does not complete any inference or persistence gate. A successful desktop pointer test does not complete a physical touch or iPhone gate. Retain the baseline until its functions have been deliberately integrated and regression-tested.
