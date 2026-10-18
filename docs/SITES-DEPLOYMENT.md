# Sites publication

Latest user authorization permits public access and continued adjustments on the published Site; earlier local-only/no-deploy instructions are superseded. The original GitHub remote was not pushed.

## Current publication (Unit198)

Public https://babelshelf.com, audience unchanged public. Version5: appgprj_6ad46c7eb3a88191b67b5fded25711d5~appgver_361e77b8379481918e5a46778db16b5a. Deployment appgdep_6ad4a66675f0819180f9b6ad4985301b succeeded. Sites sourcec27efa2cc0b681fc990efd869e7f35177ab7910c contains the canonical8e25b5b product4c7edb10dfc00ba5/113. This aligns the published UI/harness with the tested local source, including Unit179-187 corrections and the redirected-shell fix plus visible initial-preparation progress. Earlier inference evidence keeps its original build scope. Old static assets remain for existing pages; no model weights, WebML upstream runtime, notes, backups or browser profiles were packaged. The existing verified gzip delivery adapter remains unchanged.

Actual `node scripts/qa/published-progress.mjs ../../outputs/unit197-public-preparation ../../outputs/unit198-public-progress` passes. It uses the dedicated already-prepared public test profile, explicitly checks/applies the update, disables Downloads and closes Chrome, then cold-opens browser-offline. Exact new build is confirmed. Use models runs actual prepared-only verification with visible Verifying model1% progress; after completion the transient progress disappears. Notes except the explicitly toggled connection record, settings and prior processing receipts are exact. Zero external requests in this flow; screenshot inspected. No repeat model download or inference was used to validate this presentation change. No physical/OS-isolation or whole-MVP claim. Existing users should use Settings > Connection > Check for updates > Apply update; never clear local data.

## Historical publication (Unit195)

- Public URL: https://babelshelf.com (original generated hostname remains an alias).
- Audience: public, Sites access revision2; no login or service token needed.
- Saved version4: appgprj_6ad46c7eb3a88191b67b5fded25711d5~appgver_ba6528bb49208191952251a4ff478100.
- Deployment appgdep_6ad4a2bd0b1081918c89b44c924e5a65: succeeded.
- Sites source commit4c06403d55df955ba517c8441d3401fa87e13285.
- Published build984769124c99c80b/112. This release changes only the worker's redirected-shell response handling, retaining the preceding published UI assets. Current local product is separately620d24121bb7cfc5/113.
- Domain A records162.159.143.30 and172.66.3.26 plus Sites verification TXT; existing MX/SPF/wildcard/ACME records preserved. Custom-domain and TLS status active.

The earlier owner-private access and service-header SW failure below are historical. A credential-free public browser run now installs the worker successfully, but exposed a separate redirected-shell cold-start defect; see PWA-UPDATE-CONTRACT.md and TEST-RESULTS.txt Unit195. No end-user records, downloaded model weights or WebML runtime were deployed.

## Historical initial publication

- URL: https://babelshelf-device-check.unjuno.chatgpt.site
- Audience: owner-private, confirmed by Sites; access policy unchanged.
- Site: appgprj_6ad46c7eb3a88191b67b5fded25711d5
- Deployment: appgdep_6ad46e84293c8191b2260117855e2a7d (succeeded)
- Saved version: appgprj_6ad46c7eb3a88191b67b5fded25711d5~appgver_7d615b702ef0819191aa4647cb5639ed
- Site source commit: a3b1deacde83368c2e98b3fa36042aa6d7991627
- Canonical source: 555f622; product build776c70a284785c23/112.
- Sanitized Site checkout: ../babelshelf-sites-device-check (separate Sites source repository).

Only built application assets and required licensed browser runtime assets were included. No user notes, local backups, downloaded model weights, browser profiles, TLS keys or credentials were copied. WebML remains explicitly acquired from pinned upstream. Runtime-specific license limits are not replaced by the model license.

Sites rejects individual static assets above26214400bytes. One26861777byte ONNX WASM is stored as a6625019byte gzip asset. A delivery-only Worker serves its original URL using gzip or streaming decompression, Content-Type application/wasm. Decoded SHA-256 remains49871f5a4409519797e127440868a6d1923339d9185907f301a5b2a1d90af082. The app's original asset manifest/SW verification remain unchanged. This Worker provides no inference, upload, personal-data persistence or external API route; only GET/HEAD static delivery. Node adapter tests verify both encodings and405 for POST.

The first deployment failed on the25MiB file limit; retained failure deployment appgdep_6ad46dc0d6d881918866ebe19e59a9e5. Windows source helper packaging also required a task-local copy fixing Git Bash path handling and tar --force-local; installed plugin files were not edited. Successful archive: outputs/babelshelf-device-check-worker.tar.gz in the task wrapper. Publication was confirmed by native Sites succeeded response; this is not a physical-device acceptance result.

Computer Use attempted to open the local app in Edge, but state capture was stopped by its safety control because it could not confidently determine the browser URL. No visual/manual flow PASS follows from that attempt. Existing actual browser QA retains its separately recorded scope. Do not bypass browser authentication or safety interstitials. User should open the private Site with the owning ChatGPT account for initial device preparation. A new Site origin starts with separate local storage; existing PC notes are not automatically transferred.

## Live deployment correction and PC verification (Unit177)

Current deployment: appgdep_6ad471c58db081919e074b911fb88b2a (succeeded).
Saved version: appgprj_6ad46c7eb3a88191b67b5fded25711d5~appgver_368f2a46a8248191840ed7ee4f0e2283.
Sites source: 2336c4cbc778ef2f0cbcb4f229ed4a658cc862c4. Product build remains776c70a284785c23/112; audience remains owner-private.

Actual deployed Chrome fetches found one real delivery defect: the large ONNX WASM arrived as6625019 compressed bytes rather than26861777 decoded bytes. The prior local adapter encoding test did not prove the hosted response encoding. All other111 assets matched. The delivery Worker now always streams gzip decompression at the original WASM URL without Content-Encoding. Both Accept-Encoding variants pass local exact-byte checks, and all112 actual hosted assets now match their declared sizes and SHA-256, including49871f5a4409519797e127440868a6d1923339d9185907f301a5b2a1d90af082 for that WASM. No model, UI, canonical storage or user records were changed by this fix.

Actual isolated PC Chrome390x844 on the deployed HTTPS origin: reviewed new-note Save; complete browser close/reopen with same profile; search; source sheet/Open file; direct edit23 to25; History retainingv1/v2; ordered arithmetic500; Memory/Schedule/Notifications/Settings navigation PASS, with no page JavaScript exceptions. Screenshot history.png was visually inspected. This exercises real UI/storage/tools, with no model inference or mocked answers.

Reproducible helper: scripts/qa/deployed-site.mjs ABSOLUTE_NEW_OUTPUT online-only. Supply the official Site service-access JSON through hidden stdin only, never command arguments or tracked files. It uses a fresh isolated browser profile and a CONNECT allowlist for this exact Site, preventing the authorization header from reaching other hosts. Evidence is in task-wrapper outputs/unit177-site-stream-check/evidence.json; original failure retained in outputs/unit177-deployed-online-corrected/evidence.json. No credentials are included in these artifacts.

Important limit: service-access authorization opens the app and regular fetches, but does not accompany Chromium's internal Service Worker registration. /sw.js returns401 and the Offline app status is Preparation failed under this fixture. Normal owner-cookie login is a different condition and has not been verified here. Do not claim hosted cold-offline acceptance or change audience/embed credentials to make the test pass. Live hosted model preparation/generation/stop and physical-device checks also remain unverified in this unit. The user's existing in-app browser login and automated Chrome use separate sessions.


## Public custom-domain cold restart verified (Unit195)

Actual `node scripts/qa/deployed-site.mjs ABSOLUTE_OUTPUT public` passes at outputs/unit195-public-fixed/evidence.json. Fresh synthetic persistent Chrome profile, no authorization header/cookie,390x844. Phase1 reports Installed and984769124c99c80b/112, saves Japanese23-litre fixture through reviewed Save. After complete browser-context closure, a new persistent Chrome process starts browser-offline before navigation. It loads the same build, searches the retained marker, opens exact source, edits23->25 litres, displays both v1/v2, calculates500 with the actual local tool and navigates Memory/Schedule/Notifications/Settings. Both phases report no page errors, failed requests or HTTP errors. history.png visually inspected. Earlier public cold-start failure is retained separately in unit195-public-cold-run; native red/green redirect fixtures retain the causal reproduction. This closes only the public shell/storage/tool flow; no hosted real-model, physical device, OS isolation, or full MVP acceptance claim.

Existing visitors need an explicit online app update from Settings > Connection and the prompted reopen to receive the new worker. Do not clear site data or reinstall by deleting local knowledge. The domain's local storage is separate from the old generated hostname and localhost.


## Public-domain offline inference (Unit196)

On published984769124c99c80b/112, the dedicated synthetic Chrome profile imports pinned Bonsai4B/runtime from local files, closes and cold-opens browser-offline. A new natural question returns25litres with exact v2 source; reviewed Save retains exact generated bytes without another generation. Same-process explicit Unload->Load then actual cited summary succeeds. A third offline process opens the saved answer; previous notes/history/settings/runs remain intact. All three processes record zero external requests. See TEST-RESULTS.txt and outputs/unit196-public-text. This is PC ordinary browser mode, not installed/phone/OS-airplane. Direct upstream preparation and hosted Stop are untested; the one-line summary does not establish general quality. No default/runtime/model bytes changed, no redistribution or personal-data upload.


## Public first-time preparation (Unit197)

A fresh credential-free PC Chrome profile on published984769124c99c80b/112 now completes the ordinary Initial preparation flow directly from the pinned upstream assets. Prepare is disabled until explicit downloads permission; review lists the roughly1GB standard set. Bonsai4B/runtime, Whisper tiny and eng+jpn Tesseract prepare in sequence with real size/hash checks. After DownloadsOFF and browser closure, another browser-offline process reads the same shell, shows Files present/Verified and completes Use models with zero external requests. Prepared notes/settings/prior processing receipts are retained. See TEST-RESULTS.txt and outputs/unit197-public-preparation. This supersedes Unit196's direct-upstream preparation gap only; it is not inference/media/device/OS-isolation or interrupted-download acceptance. Runtime redistribution remains unapproved; direct preparation is not redistribution by the Site.


## Published combined media (Unit199)

Public4c7edb10dfc00ba5/113, prepared-only PC Chrome/browser-offline: one ordinary Send processes TXT/MD/PNG/PDF/WAV using actual OCR/PDF/Whisper, then actual Bonsai answers from the new text and image with validated citations. All5raw originals match input bytes; exact answer Save, index rebuild and separate cold search/original retention pass. Another offline process opens the cited image's region, changes original PDF pages and starts native original-audio playback. Canonical records are unchanged by previews; an export-timestamp comparison error and its read-only revalidation are preserved. See TEST-RESULTS.txt and outputs/unit199-public-media. This is not physical sensors/audibility, video vision, broad accuracy, OS isolation or whole-MVP acceptance.


## Unit201 publication and rejected update (2026-10-18)
Sites version6 publication succeeded: source9cecf3abf2c7d21512584a62c8abef08319074b5, saved appgprj_6ad46c7eb3a88191b67b5fded25711d5~appgver_6488e358581081919a3d4dea8d4dabf6, deployment appgdep_6ad4a9b4840881918f579c9310fcb050. Audience remains public, URL https://babelshelf.com. Archive outputs/unit201-public-schedule.tar.gz contains the localc6b70e91d9f67ab1/113 product built from canonical7c0556b. Delivery WASM decompression verification passed; GitHub was not pushed.

Actual retained-profile `node scripts/qa/published-update.mjs ../../outputs/unit197-public-preparation ../../outputs/unit201-public-update c6b70e91d9f67ab1` FAILED waiting120seconds for Apply update. Do not call this a successful update/offline test. The saved before.brainpack remains; no data clearing or model preparation occurred. Subsequent real Chrome inspection retains active4c7edb10dfc00ba5 and no waiting worker. Direct browser HTTP response reads currentc6b70e91d9f67ab1 build.json.

Independent actual public response verification checks all113files:112match size/SHA, index.html fails (773expected versus1711received). The retained mismatched-index.html contains an injected Cloudflare challenge-platform/jsd iframe script absent from canonical HTML. Its dynamic challenge payload changes between responses. This establishes a delivery-byte mismatch that the strict worker must reject; do not weaken hashes, strip arbitrary injected scripts into trusted bytes, or mark Installed as proof of the latest update. Fresh preparation/current-build cold restart remains unverified. Prior publicv5 acceptance retains its original scope. An auxiliary Python urllib request returned403; real Chrome request returned200 and the actual bytes above, so the urllib response is not app content evidence.

Next: preserve exact offline-shell bytes through a delivery path not subject to HTML injection, retaining normal online navigation and immutable source validation; verify actual deployment bytes, retained-profile update and cold restart. Publicv6 is published but this update-delivery defect is unresolved. Evidence outputs/unit201-public-update/evidence.json, asset-check.json, inspection*.json and mismatched-index.html; diagnostic source retained there. Do not repeat model generation to diagnose this HTML delivery issue.
