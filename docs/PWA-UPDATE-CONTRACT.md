# Offline app updates

App acquisition/update remains explicit through Downloads & updates. Installation checks each emitted asset's exact size/SHA before saving that response. Fingerprinted assets use the shared content-addressed pool described below; shell and nonfingerprinted resources remain per build. The product build identifier includes both the asset manifest and the app-owned generated-worker source. A worker-only correction must not silently share the previous build identifier. Model/runtime OPFS stores and canonical IndexedDB records are outside this worker's cache routing.

Activation claims existing pages. Those pages can still contain an older compiled entry module and lazy-import URLs; activation is not page reload and must not erase unsent input. Current navigation always resolves the active build's index. Current-cache assets retain priority. A missing same-origin immutable hashed `./assets/<name>-<8-character-hash>.<extension>` may resolve from exact app-owned `babelshelf-product-<16 lowercase hex>` CacheStorage namespaces. These responses were individually verified when the older worker saved them, including any valid subset left by a failed installation. Historical lookup performs no network request. Ordinary missing resources, old nonasset paths, unrelated cache names, remote URLs and non-GET requests do not gain fallback authority. Current remote asset allowlisting and the separate explicit preparation permissions remain unchanged.

The fallback preserves already open preprotocol pages as well as later app builds. It does not repair a module import that a browser has already cached as failed in a particular document; reopening that failed page may still be necessary. Unit24 reproduced the old failure and separately verified a not-yet-failed older page under the corrected worker without reloading it. Both results are retained in TEST-RESULTS.txt.

## Retention boundary

This correction retains historical app caches. It does not claim disk reclamation. Blind pruning based only on currently enumerated clients is not an adequate cross-browser retention contract: [WebKit's lifecycle notes](https://trac.webkit.org/raw-attachment/wiki/DOMBindingsEventLoopNotes/Back-Forward-Cache.pdf) describe a page disconnecting from its Service Worker when placed in the back/forward cache. Such a page may later resume with older module URLs and unsent input. Merely reporting entries from active clients would leave that case unresolved.

Storage reclamation remains open. A candidate next design is deduplicating identical fingerprinted app assets while preserving every retained URL and historical shell, with verified copy-before-release and quota/interruption recovery. It needs separate lifecycle/old-worker/BFCache tests before deleting app cache entries. Canonical notes, originals, history, model assets and foreign caches are never cleanup targets. This is a dependency remaining in the whole goal, not a claim that retaining every build forever is satisfactory storage management.

## Shared assets (Unit38)

New generations store immutable hashed assets in `babelshelf-product-assets-v1`, addressed by the complete SHA-256 within the registration scope. Installation rehashes any existing pooled response against the requested size/hash before reusing it. A missing or corrupt entry requires the existing explicit installation acquisition and verification; normal fetch misses never acquire assets.

Each build publishes `./.babelshelf-app-manifest-v1` only after all its resources verify. It maps that generation's immutable URLs to pinned shared bytes. Current embedded pins have priority; exact retained historical build metadata can resolve old lazy-module URLs. Metadata validates its owning build, paths, hashes and sizes. Internal pool/metadata URLs are not served as product resources. Legacy flat caches remain compatible and untouched.

A failed install can leave verified reusable pool entries, but cannot publish its completion metadata early or remove previous generations. No pruning or migration occurs. This reduces duplicate immutable binary storage for future generations; accumulated legacy copies and distinct historical modules remain. Logical response counts do not establish physical disk savings, native quota recovery or BFCache acceptance. Those remain separate gates.

## Native update fixture (Unit106)

The isolated Chrome fixture in scripts/qa/update-bfcache.mjs uses the actual productWorker with static assets, not model inference. In live mode, an old visible page retains its unsaved draft after a second generation activates; offline, its old lazy module and actual module Worker both load successfully. The common asset is fetched once across both installs; five unique immutable responses occupy the shared pool, and each generation contains only its shell and completion metadata. These are logical cache counts, not physical storage measurements.

A simpler earlier BFCache fixture retained its page and old lazy module. The expanded Worker/BFCache fixture remains unresolved: observed variants either timed out or reloaded the page. Live-mode success does not close that gate. No cache reclamation, legacy migration, quota-pressure recovery or phone acceptance follows.

## Redirected static-host shell (Unit195)

A static host can redirect `/index.html` to `/` while serving the exact pinned HTML. Installation still verifies and retains the original response. When serving navigation from a cached redirected response, the worker constructs a response with the same verified body/status/headers but without network redirect metadata, Content-Encoding or Content-Length. The body is already decoded. Chromium otherwise rejects this cached response for navigation with ERR_FAILED, even though installation and cache readback succeeded. This applies to existing caches without rewriting or deleting them; missing assets still fail locally.

The native `scripts/qa/redirected-shell.mjs OUTPUT` fixture uses actual HTTP302, the production worker and a retained Chrome profile. The pre-fix cold offline process fails; the corrected worker passes after the owned HTTP server stops. This is a browser protocol regression test, not model or device acceptance. Public Site verification is recorded separately in SITES-DEPLOYMENT.md.


## Verified binary shell transport (Unit202)
The built index.html entry now declares downloadPath=./offline-shell-<full SHA-256>.bin. This generated companion contains exactly the same HTML bytes and is published alongside index.html. Normal online navigation still uses index.html. Installation fetches the companion, verifies the unchanged HTML size/SHA, then constructs a text/html UTF-8 response under the canonical index.html cache key, removing stale transport encoding/length and redirect metadata. Readback is verified as before. No response sanitization, changed trust anchor, fallback acquisition, canonical-data migration or cache deletion occurs. A modified or missing companion rejects installation. The binary companion is transport only; ordinary offline resource misses still fail locally.

Sites publication must copy each declared downloadPath as well as each path, and serve the companion as application/octet-stream rather than HTML. The public host previously injected Cloudflare script into index.html (Unit201). Normal online HTML may still receive that host script; the verified offline shell must not contain it. Unit tests cover unchanged bytes/MIME, refusal of modified transport and no offline fallback. Production acceptance checks companion byte identity and content-addressed name. Actual public update/cold-restart evidence follows separately; local build a834b3c08c84e2da/113 alone does not certify deployment.
