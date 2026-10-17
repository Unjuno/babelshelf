# PWA installation evidence and limits

The product manifest declares standalone display. The favicon stays the existing blank white SVG. Home-screen assets now include opaque-white192/512 PNGs (any/maskable) and a180 PNG with an explicit apple-touch-icon link. The Apple link follows the archived [Safari Web Content configuration reference](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html); metadata alone does not prove current iPhone behavior.

## Local startup

Run `npm run build:app`, then `npm run dev:app -- 4180` when that port is free. The server defaults to4182 without the argument. Keep the same origin/port to access existing browser storage; another port is a different origin, not a migration. Do not clear existing data to update the app. Existing tabs may require the explicit Settings/Connection app-update flow and should return Downloads to OFF afterward.

## Native PC check

`node scripts/qa/installed-pwa.mjs NEW_ABSOLUTE_PROFILE NEW_ABSOLUTE_OUTPUT` serves the built app on its own temporary loopback origin, registers it through native Chrome CDP PWA.install, sets the test installation's native display preference to standalone, then launches it through PWA.launch. This preference is needed by this CDP setup: installation alone originally opened browser display and the strict assertion failed. The test never changes matchMedia or emulates a successful standalone result.

The same existing record/import/search/edit/history/index/backup/conflict/no-op-restore flow runs in three distinct persistent browser processes. After first preparation the fixture server stops; later browser processes are offline before PWA.launch. Every phase must report actual standalone=true, browser=false, expected build and a different browser PID. The app registration and public fixture data remain in the dedicated QA profile for inspection. Existing personal/maintained profiles are not migrated or cleared.

`node scripts/qa/verify-installed-pwa.mjs OUTPUT` independently production-parses all four backup archives, cold-launches that installed test app offline, checks its expected Service Worker build and decodes all three PNGs to verify dimensions and every opaque-white pixel.

Unit129 Chrome155 passed this scoped flow in profile pwa-installed-unit129b on loopback origin http://127.0.0.1:60051/ with the server stopped. Artifacts are outputs/unit129-installed-setting. Initial failure is retained separately under unit129-installed. Icon metadata does not close iPhone/Android installation, physical OS integration/network isolation, touch/IME or sensor acceptance. This profile has no prepared inference/media models, so the result does not prove their execution in an installed app. Ordinary PC offline inference is separate evidence in TEST-RESULTS.txt.
