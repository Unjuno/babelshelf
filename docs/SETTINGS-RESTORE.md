# Reviewed settings recovery — Unit73

Existing strict/add-only state restoration retains conflicting destination settings. Add an explicit settings-only review within the existing backup sheet: show current and effective incoming bodies, then Apply settings. Nothing is selected or applied automatically. This is user-approved local recovery, not model editing or general history reconciliation.

Only the three existing managed Settings IDs/paths qualify. Validate incoming/current values; append effective imported values as new revisions on the current records, preserving IDs, every current revision and metadata. Retain each changed group's complete imported source record in a non-executable recovery receipt with the verified source envelope checksum. Source history is readable from that file's History / Backup history. Unchanged groups need no revision or receipt; keep the source backup for their histories. Preserve imported downloads-ON as source bytes but force the effective value OFF. Model registration/selection is data only: never prepare, load, enable tools or execute imported tasks. Model readiness comes from actual assets.

The reviewed whole-state fingerprint must still match inside one notes/settings/runs transaction. Recompute the plan; update only reviewed managed settings and add one receipt atomically. All other canonical records, original assets, auxiliary state and dialogue remain unchanged. A stale review fails with no partial writes. The source backup remains necessary for unrelated/skipped histories. No arbitrary divergent-note merge, larger-archive support or full fresh-device equivalence is claimed.

Acceptance: current history/source history retention, strict IDs, effective downloads OFF, changed/future settings refusal, atomic receipt + versions and stale fingerprint; actual native review/approve/restart/export, settings controls and Memory agree; imported models are not loaded and no acquisition is triggered. Keep accepted sheet layout with scrollable fields/fixed actions.


## Evidence

Final build92ab25e5e8dc746b/99assets, PC Chrome155, `node scripts/qa/settings-restore.mjs <new-source-profile> <new-target-profile> <new-output>`: native source Appearance dark/sage/frosted, Qwen registration/selection without assets, ConnectionON; target review; another tab changed background before approval -> stale review refused and all stores exact; fresh review -> appearance/models appended one version each, all previous destination versions/metadata, other records and auxiliary state exact. One receipt retained exact source records and matched the source envelope checksum.

Browser close/new process with context offline before navigation: Settings and Memory agreed, backup source v1 read from History separately from destination history, re-export retained notes/runs, ConnectionOFF and no loaded model. All phases observed zero external requests; OPFS file inventory empty. Artifacts outputs/unit73-settings-c/{source,before,raced,stale-retained,after,restart.brainpack,evidence.json,review.png,stale.png,models.png,memory.png,history.png}. Earlier compatible runs remain in unit73-settings-a/b. Review/history screenshots inspected.

Intermediate build59b725e37fc58b9b also passed existing original-rich fresh Restore new/offline-source regression (outputs/unit73-media-regression): ten conflicts kept;14notes/20linked entries/five originals added, PNG/WAV/PDF opened/downloaded with exact hashes. This is a scoped intermediate-build regression, not final-build all-function or audible-playback acceptance.

Final prototype299/299, TypeScript noEmit, product build, test:app2/2, shell29pins, protected-runtime28files passed; baseline70/70 passed during this unit. No inference/Android/iPhone/installed-PWA acceptance added. Arbitrary divergent histories/dialogue reconciliation, large archives/quota and whole-device offline acceptance remain open.


## Restore bundled defaults (Unit265)

Settings > Restore defaults reviews a reset of the three managed preference records. The UI captures all three projected records when opening the confirmation. One canonical transaction compares every reviewed record, including groups whose reviewed values already equal the defaults, then appends changed default values. A concurrent edit refuses the entire operation with an inline error; cancellation writes nothing. Existing revisions, user notes, auxiliary state, tools and OPFS assets are retained. Model registrations/selections reset as disclosed in the confirmation; their former definitions remain in history and retained asset bytes are not deleted. This action does not prepare/load any model.

Malformed preference bodies use in-memory safe defaults without overwriting those bodies. Startup also uses downloads OFF when the connection record cannot be parsed, so the user can reach Memory and explicit recovery. Missing/invalid canonical record structure remains outside this malformed-preference recovery contract. A reset in progress blocks dismissal and new foreground task claims. Failed validation/save stays in the confirmation with an inline error.

Native PC Chrome evidence on b062aa03fd16cc32/117: normal reset/Cancel, injected malformed models+appearance+connection, unchanged histories and other records, retained OPFS sentinel, reload and two-tab stale approval refusal. The initial native run reproduced a boot lockout at the connection parser; the fix preserves malformed bytes until explicit restore. This does not certify arbitrary database corruption recovery, physical devices or model execution. Reproduce with `node scripts/qa/settings-defaults.mjs OUTPUT_DIRECTORY http://127.0.0.1:4184/`.
