# Citation assertion audit

Unit220 found17ignored `validateGroundingRefs` results in13browser-QA scripts. This core API returns `{ok,errors}`; calling it without checking `ok` did not assert citation validity. The scripts now explicitly assert success. Product validation logic was not changed. Earlier observations of actual generation, UI operations and storage retain their scope, but the ignored call alone was insufficient citation evidence.

Read-only revalidation uses `scripts/qa/verify-retained-answer-refs.mjs OUTPUT_JSON ARCHIVE...`. It parses each original brainpack, checks the last sourced answer against that snapshot's notes, records archive SHA/turn ID/ref count/errors, and requires rejection when a source ID is replaced with a nonexistent one. It writes a new receipt only, never changes the archive or regenerates an answer.

| Original evidence | Snapshots rechecked | Result |
|---|---|---|
| Unit126 natural answer | after | PASS |
| Unit130 installed text | answered, saved, after-restart summary | PASS |
| Unit133 installed video audio | after-video | PASS |
| Unit137 explicit generation-stop recovery | after-retry (fixed observer run) | PASS |
| Units153,162,173 mixed-input integrations | each answered | PASS |
| Unit193 installed question and summary | answered, summarized | PASS |
| Unit194 generation-stop recovery | after-retry | PASS |
| Unit196 public text | answered, saved, after-restart summary | PASS |
| Unit199 public mixed media | combined | PASS |
| Unit204 read completion | after | PASS |
| Unit211 WebM and Unit213 MP4 | each after-video | PASS |

Receipts: outputs/unit220-retained-refs.json (3snapshots), unit221-retained-refs.json (9), unit221-retained-more.json (5), unit221-retained-summaries.json (2). These19snapshots include two saved snapshots of already checked answer turns. All returned `ok:true` and rejected missing-source controls. Paths and exact archive hashes are in the receipts.

Failed Unit161 citation mismatch and Unit181/182 semantic/GPU attempts are not converted to successes. This audit does not claim every historical artifact was checked, that current-build inference reran, or that structurally valid citations prove semantic correctness, exhaustive coverage, phone behavior or whole-MVP completion. It closes the ignored-return evidence gap for the explicitly listed successful flows.

## Product boundary check (Unit222)

All direct validateGroundingRefs/validateRefs call sites under design/prototype/src and dist were inspected. The ignored-return defect was not found in product admission: core create_note, KnowledgeStore generated Save and task completion check `.ok`; grounded-answer checks current source eligibility plus `.ok` before and after generation; backup checks historical references separately. No speculative production patch was made.

The existing input-readings, working-file and knowledge-store suites pass45/45 on current source (outputs/unit222-source-boundaries.txt). Their scope includes changed/withdrawn current inputs, competing file targets, source changes during generation, stale generated ancestors and source edits in the same atomic Save. This targeted rerun addresses the newly discovered QA-validation risk, not fresh model or physical-device acceptance. Further repetition without a new change is unnecessary.
