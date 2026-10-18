# Sites device-check publication

Latest user authorization permits Sites deployment for physical-device checks; earlier local-only/no-deploy instructions are superseded for this publication. The original GitHub remote was not pushed.

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
