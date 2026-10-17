# Offline PWA update continuity and cache retention

**Goal:** Explicit app updates must not break lazy readers in already open app pages, and obsolete app assets must have bounded retention once live clients are identified. Preserve all canonical data/model OPFS/foreign caches.

**Current evidence:** generated SW claims old clients on activation but fetches only the new build cache; absent app assets return503. There is no app-cache reclamation. Thus old lazy modules can be unavailable despite their verified cache still existing. Need actual browser reproduction before claiming this bug fixed.

**Design:** Extract generated SW construction into an app-owned builder with VM lifecycle tests. Current cache handles navigation/current assets; missing immutable local hashed asset paths may resolve through owned verified historical app caches, without HTTP fallback. Preserve historical app assets for already open pages. A proposed active-client entry-report/pruning design was rejected as incomplete during lifecycle investigation: back/forward cached pages can disconnect and later resume with older URLs/unsent input. Storage reclamation needs a separate copy-before-release/deduplication contract; IDB, OPFS, foreign caches and model assets remain outside cleanup authority. No automatic cache deletion is implemented in the compatibility correction.

**Validation:** tests must cover old lazy module after update, ordinary missing asset/no fetch, foreign cache isolation, failed install atomic completion, active/unknown-client protection, worker restart, final-client close, handshake input validation and safe cleanup. Product build ID must reflect SW source changes. Native two-version update/old-tab lazy read, offline new-tab boot/new reader, model/data preservation and backup/restore are separate acceptance checks. Do not bypass browser security or clear user profiles/data.

Also clear stale Bonsai progress after successful generation (current Settings otherwise says Generating/Prefill while idle). This affects progress reporting only; generation/model pins stay unchanged.

- [x] Capture actual old-client failure on a deliberate new local build.
- [x] RED/GREEN generated worker continuity tests and worker builder. Current/historical/foreign cache boundaries and no-network fallback verified.
- [x] Full tests/builds/review and native two-version offline update/data checks.
- [ ] Storage reclamation/client retention remains open: active-client reporting alone cannot protect back/forward cached documents. See PWA-UPDATE-CONTRACT.md for the researched boundary and candidate copy-before-release deduplication. No cache deletion or entry reporting is implemented in this bounded compatibility correction.
- [x] Record results/limits. Full MVP/device gates remain active.

Unit24 scoped result: initial3a old page plus bd459fe4fc0ee4b8 worker failed old Bsxcw1BM lazy import. Corrected0171a7bb7f4f3b37 worker then controlled an already open bd page (index-k8gCrXFn), with HTTP cache disabled and tab network offline: PDF rendered and real local OCR completed through its OLD lazy modules. New current index-DwP_J3mo booted with data retained. Baseline44/prototype172/product2/Markdown4/check24/protected28/builds passed; independent worker/source probes found no Important findings. Export38 retained78notes/95runs/33originals, exact older notes/history/settings/originals except explicit managed connection revisions; dialogue unchanged and one completed old-tab PDF read receipt added. No data reset/push/deploy, model/runtime changes or cleanup-completion claim.
