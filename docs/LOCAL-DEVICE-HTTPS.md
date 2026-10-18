# Local HTTPS for physical-device acceptance

This serves built application files from this PC. It does not provide inference, an upload endpoint, a proxy, or synchronization. Models and personal-data processing remain inside the phone. Public deployment and tunnels are not required or started.

User confirmed use of the previously described `17air`; exact displayed model name and iOS version remain unverified. PC WebKit is not a substitute for its Safari acceptance.

## Prepare the origin

Choose a stable IP assigned to the PC on the private network shared with the phone. Provide a certificate chain and matching private key whose IP subject alternative name covers that address. The phone must trust that certificate through a deliberate user-managed setup. A browser certificate-warning bypass is not evidence that PWA secure-context requirements passed. This command does not generate/import certificates, change system trust, open firewall rules, or start a tunnel.

Keep the private key outside `design/prototype/dist/app` and outside any served directory. Never copy it into an app backup or commit it. The server rejects TLS paths under the built app directory.

```powershell
npm run build:app
npm run dev:app:https -- --cert "C:/local-certificates/cert.pem" --key "C:/local-certificates/key.pem" --host YOUR_PC_IP --port 4183
```

Replace paths and `YOUR_PC_IP` with the actual chosen values. Without `--host`, it binds only `127.0.0.1`, which a phone cannot reach. Wildcard and nonlocal bind addresses are rejected. Use a certificate trusted by the device; the QA self-signed certificate is short-lived, loopback-only and not installed in any trust store.

The phone opens `https://YOUR_PC_IP:4183/`. Keep this origin stable: changing scheme, address or port creates a different browser data origin. Existing PC data is not automatically copied to it. Use a reviewed local backup if needed, preserving the existing origin and archives; never clear storage to switch origins.

## Short first physical check

1. Record displayed device model, OS version, browser and actual app build. Confirm the origin opens without certificate warnings and the installed app is using the intended build. A visible page alone does not prove successful PWA preparation.
2. In Connection, inspect Offline app state. `Installed` is worker lifecycle, not an all-assets/device certificate. Explicitly allow preparation, select and prepare the intended local models, then turn Downloads OFF.
3. Capture one distinctive note and import a small TXT/MD. Open their originals. Install/open the PWA using the device's available browser operation.
4. Enable airplane mode and explicitly turn off Wi-Fi. Fully close and reopen the installed PWA. Search the note, rebuild the index and read the original. Ask a new sourced question, inspect its source, review and save its exact answer, unload/reload the model. Record errors rather than retrying until a desired answer appears.
5. Check direct correction/history, reviewed model correction/stale conflict, local backup/restoration conflict, prepared media and foreground schedule/result/notification flows. Keep each result separate; the short first check does not pass all these automatically.

Do not promise execution when the PWA is closed or suspended. Record phone capacity/memory/storage failures separately from PC results. Actual full acceptance still requires the remaining gates in REMAINING-GATES.md.

Stop the static server with Ctrl+C after preparation/testing. During airplane-mode cold acceptance the PC server should be stopped as well. This helper has been verified by native Node HTTPS on PC, not yet by a physical phone or trusted Safari origin.
