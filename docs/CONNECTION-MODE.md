# Application connection mode

Settings > Connection > Mode offers Offline / Online. Offline is the default. This is an application preference, independent of the browser's device-connection hint. Online never selects remote inference, uploads knowledge, enables MCP or starts acquisition automatically. Existing explicit acquisition, pinned URL, preparation and tool permissions still apply.

## One source of truth

The existing canonical managed `Settings/connection.md` record is authoritative. Its historical `downloads` boolean now supplies the mode (`false` = Offline). No second network flag, permission database, schema reset or history rewrite is introduced. Existing explicit values remain; new installs and default recovery stay OFF. Settings changes append revisions through the existing writer. Connection remains outside model-editable settings patches. Backup/restore uses the existing connection policy and reviewed history.

The production worker reads only `settings-connection` from `mlb-memory-v1` in a read-only transaction for each eligible external request. Missing, malformed, withdrawn, wrong-path or unavailable settings deny network. Opening a nonexistent database aborts the upgrade instead of creating/migrating data. Reads time out closed and close their handles. Worker restart and another tab do not inherit an in-memory permission grant.

## Enforcement

Cross-origin GET requires both canonical Online permission and the existing finite built-in URL allowlist or exact one-use HF grant. Non-GET remains denied. Same-origin resources remain cache-only; missing local assets never trigger acquisition. Local inference, readers, search, editing and backup retain their existing prepared-only paths.

After Offline commits, the page requests an acknowledged revocation from its controller. The worker rechecks canonical permission, invalidates requests awaiting permission, clears unused HF grants, and aborts controlled in-flight fetches including their streaming bodies across its tabs. New requests remain closed. No response buffering is added; decoded response bodies drop obsolete encoding/length headers. Memory edits, restored preferences and controller changes trigger the same revocation effect. A missing/old controller is not reported as an enforcement success; direct selection reports that an app update is required. Switching Online permits later explicit requests; it does not restart a stopped download or replay a task.

Replacement app installation checks canonical permission before acquisition and between missing resources while an active registration exists. First app bootstrap still acquires its verified shell before offline use is possible. An already verified waiting update can be applied Offline. Older active clients cannot receive new enforcement retroactively; they need the normal app update.

## Limits and evidence

This controls application requests handled by the current worker. It is not an OS firewall and cannot undo requests already transmitted. Browser-managed service-worker script checks, initial document/hosting scripts, unrelated tabs and resources outside the worker's scope are not claimed to be blocked. The browser's device-online hint does not prove Internet reachability. Physical isolation and cold offline acceptance remain separate.

Controlled Node tests cover canonical read/restart/failure, cross-tab denial, grant revocation, active response-body cancellation, retained local navigation and denied replacement acquisition. These use the actual generated worker in a controlled harness, not real browser/phone acceptance or model inference. Public delivery and any actual browser evidence belong in TEST-RESULTS.txt.
