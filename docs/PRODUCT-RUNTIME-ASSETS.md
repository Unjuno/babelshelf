# Product runtime assets

## Contract

The product manifest describes each built asset by its deployment-relative path, byte length, and SHA-256 digest. It also marks runtime assets with the feature roles that need them. The Service Worker installs the app shell and ordinary UI files first; optional WASM files and feature-specific worker/runtime JavaScript are excluded from that install. This includes the Decision, Speech, Vision, alternate text-engine and PDF processing bundles. Model weights remain in their own model stores and are not mixed into the app cache.

This lets someone install the PWA for local notes without silently downloading every inference stack. The build manifest still pins optional assets, so an explicit preparation request can identify the exact expected bytes.

## Explicit preparation

Preparing a selected model or PDF reader goes through the controlled same-origin Service Worker with a fixed feature role and operation ID. The build assigns every optional worker bundle to the same role used by its preparation flow. The worker checks the current app network permission, fetches only that role's build-pinned files, validates size and SHA-256, and stores verified responses under content-addressed keys. A local-only verification request uses `acquire: false`; it never substitutes a fetch. Stop aborts the active request. Each runtime preparation is written to processing history with the feature role and whether network acquisition was permitted.

Model preparation verifies or imports model data separately. For an initially selected model set, the app checks every selected role even if its weights were already present, because its runtime bundle may still be absent. Only missing model bytes count toward the model-set download estimate; runtime bytes are represented by their pinned app assets.

## Offline behavior

After a feature runtime has been prepared and verified, it can be used offline from the retained app cache. If it is missing or corrupt while Offline is selected, verification fails closed and the UI asks for explicit preparation. The Service Worker fetch handler never repairs a missing runtime implicitly. Switching the app Offline also aborts active external requests and prevents later runtime acquisition.

Older shared content-addressed responses and app generations are retained; this path does not delete or migrate model data. Cache pruning is deliberately separate work because it needs a user-reviewed storage policy.

## Evidence and limits

`npm run build:app` emits and hashes the role-tagged manifest. `tests/product-worker.test.mjs` verifies shell-only installation, explicit feature acquisition, digest and size rejection, Stop, offline reuse, concurrent exact-write recovery, and no acquisition for missing offline assets. The production acceptance test checks that each built feature Worker and both PDF JavaScript chunks carry their selected role. `scripts/qa/offline-process.mjs` exercises the production PWA in PC Chromium with a persistent profile and a network-disabled browser process. Results and scope are recorded in `docs/TEST-RESULTS.txt`. This remains PC Chromium evidence, not iOS Safari, physical networking, GPU/model inference, storage durability under pressure, or a complete offline workflow on a phone.
