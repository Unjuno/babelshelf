# Desktop process-restart storage check

Run the built product server first (`npm run build:app`, `npm run dev:app -- 4180`). Install the existing prototype dependencies with its pinned lockfile if missing. This QA command reuses Playwright1.61.1 from that lock and installed Chrome via channel `chrome`; it never installs a browser, prepares models or clears storage.

```
npm run test:offline-process -- C:/absolute/new-qa-profile C:/absolute/new-qa-output
```

Both paths must be absolute and not already exist. Use dedicated QA paths, never your normal browser profile. Existing paths are refused before writes. Each run retains its profile, public TXT/MD fixtures, brainpacks, history screenshot and evidence.json for inspection. No cleanup/purge is automatic. The command accepts a Playwright BrowserType programmatically through `runOfflineProcessCheck` as well.

The test creates a persistent Chrome context, records a public multilingual note through Input review, imports TXT/MD through the browser file input and saves a local backup. It closes that complete browser and launches the same profile in a distinct browser process with `offline:true` already set before navigation. It checks search, source version, direct correction/history, reindex and attachment search, then closes again. A third distinct offline process must retain the correction and originals, refuse a conflicting older backup, and restore an identical full-state backup without changing notes/settings/runs. Backups are compared outside the browser; raw originals must match the generated UTF-8 bytes/SHA, old revisions and unrelated notes/runs must survive. Each search must add a new turn with the exact submitted request and expected original content; stale or unrelated Found1 text cannot pass. Prior dialogue turns/compaction and unchanged settings are compared across restarts as well. Assertions fail the run; failures retain evidence rather than resetting/retrying.

Browser PIDs come from the public CDP SystemInfo API, build identity from the existing service-worker build protocol plus the loaded script URL. Every context is closed in finally. The Unit49 Windows run separately checked that all recorded dedicated PIDs were absent after completion. A script pass is one PC storage-lifecycle flow, not all-product acceptance.

Limits: headless PC Chrome with a360x780 viewport, Playwright per-context offline mode rather than OS/radio isolation. This is a real process restart, but not an installed-PWA launch or physical phone. Model/runtime assets are intentionally absent; inference, speech/OCR/media understanding and their offline loads are not tested. No physical microphone/camera, mobile eviction/quota, divergent-history merge, background wakeup or OS notification delivery claim. The ordinary browser tab and its existing data remain separate.
