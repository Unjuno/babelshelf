# PWA installation evidence and limits

The product manifest declares standalone display. The favicon stays the existing blank white SVG. Home-screen assets now include opaque-white192/512 PNGs (any/maskable) and a180 PNG with an explicit apple-touch-icon link. The Apple link follows the archived [Safari Web Content configuration reference](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html); metadata alone does not prove current iPhone behavior.

## Local startup

Run `npm run build:app`, then `npm run dev:app -- 4180` when that port is free. The server defaults to4182 without the argument. Keep the same origin/port to access existing browser storage; another port is a different origin, not a migration. Do not clear existing data to update the app. Existing tabs may require the explicit Settings/Connection app-update flow and should return Downloads to OFF afterward.

## Native PC check

`node scripts/qa/installed-pwa.mjs NEW_ABSOLUTE_PROFILE NEW_ABSOLUTE_OUTPUT` serves the built app on its own temporary loopback origin, registers it through native Chrome CDP PWA.install, sets the test installation's native display preference to standalone, then launches it through PWA.launch. This preference is needed by this CDP setup: installation alone originally opened browser display and the strict assertion failed. The test never changes matchMedia or emulates a successful standalone result.

The same existing record/import/search/edit/history/index/backup/conflict/no-op-restore flow runs in three distinct persistent browser processes. After first preparation the fixture server stops; later browser processes are offline before PWA.launch. Every phase must report actual standalone=true, browser=false, expected build and a different browser PID. The app registration and public fixture data remain in the dedicated QA profile for inspection. Existing personal/maintained profiles are not migrated or cleared.

`node scripts/qa/verify-installed-pwa.mjs OUTPUT` independently production-parses all four backup archives, cold-launches that installed test app offline, checks its expected Service Worker build and decodes all three PNGs to verify dimensions and every opaque-white pixel.

Unit129 Chrome155 passed this scoped flow in profile pwa-installed-unit129b on loopback origin http://127.0.0.1:60051/ with the server stopped. Artifacts are outputs/unit129-installed-setting. Initial failure is retained separately under unit129-installed. Icon metadata does not close iPhone/Android installation, physical OS integration/network isolation, touch/IME or sensor acceptance. This profile has no prepared inference/media models, so the result does not prove their execution in an installed app. Ordinary PC offline inference is separate evidence in TEST-RESULTS.txt.


## Unit130: real text inference in that installed profile
The two fixed public Bonsai4B/runtime cache files were read by exact manifest SHA from the prepared QA profile using a static cached SVG document, not the application UI or knowledge database. The download/export hashes and sizes are verified. Files remain outside the Git repository; copying them locally grants no runtime redistribution license. The original profile is not cloned or migrated.

The installed public fixture explicitly imports those two files through normal Models/Import files with downloads OFF. After closing that browser process, a new offline standalone launch loads the retained built-in4B model, answers a new natural question with24 liters/current originalv2 citation, reviews/saves the exact answer without another generation, and unloads. Another cold standalone process reads that saved note byte-for-byte and generates a fresh source-grounded summary. All prior notes/settings/runs/dialogue originals remain, with only the new intended note/operations/turns added. Source HTTP server60051 stays stopped.

Command: `node scripts/qa/installed-text.mjs INSTALLATION_OUTPUT PUBLIC_ASSET_OUTPUT NEW_OUTPUT`. Unit130 artifacts are outputs/unit130-installed-text-fixed; prepared public assets/export receipt are outputs/unit130-public-text-assets. Initial Unit130 failure is separate: the QA script incorrectly required crossOriginIsolated=true before trying the actual runtime. The fixed Bonsai path is verified with observed false; this observation is not a compatibility guarantee for other thread-dependent runtimes. Actual standalone/offline/build/citation/data-preservation assertions remain mandatory.

This closes the installed text-generation/save/unload/cold-reload subset on native headless PC Chrome, not installed OCR/ASR/video, a new installed Stop control, physical devices or OS airplane isolation. Runtime license provenance remains separately unresolved as recorded in the model manifest; no runtime file is added to this repository by this test.
