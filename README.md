# BabelShelf — local knowledge PWA

A smartphone-oriented, local knowledge interface inspired by GBrain. Stored knowledge is the source of truth; models are interfaces for operating on it.

**The UI direction is settled enough for integration. The usable offline MVP is not complete.** There are two runnable surfaces:

| Location | Purpose | Current limits |
| --- | --- | --- |
| `dist/` | Baseline PWA: IndexedDB records, immutable revisions, source ranges, search, backup validation and pinned Bonsai asset infrastructure | Older Input / bottom Markdown toggle; real inference, device and complete offline acceptance remain unverified |
| `design/prototype/` | Accepted glass UI, hold-and-slide navigation, Home breadcrumbs, editor/history previews, model-role selection, media previews, appearance and notification details | Canonical IndexedDB note/settings adapter, literal capture/search/read, TXT/MD import, edit/history and note backup/restore; real inference, durable media/tasks and production PWA shell pending |

Read [the accepted product specification](docs/PRODUCT-SPEC.md) and [integration plan](docs/IMPLEMENTATION-PLAN.md). Do not carry the old bottom-toggle layout into the new UI simply because baseline source checks still cover it.

## Start the accepted UI

Node.js **22.18+** or a compatible newer version; this handoff was checked with Node 24.6.0.

```sh
npm --prefix design/prototype ci
npm run dev:prototype
```

Open http://127.0.0.1:4180/. The command binds to localhost. If occupied:

```sh
npm --prefix design/prototype run dev -- --host 127.0.0.1 --port 4181
```

The phone frame/keyboard are browser simulations. Model choices are candidates, not loaded models. There is no fixture conversation. Remember/記録, Search/検索 and Read/読んで use real local records. Capture opens a review before saving. Text attachments sent from the composer become new originals. Notes and Settings persist in IndexedDB across reloads; schedules, notifications and media players are not yet integrated. The production PWA shell and inference remain pending.

## Start the baseline PWA

No npm installation is needed for the plain-JavaScript baseline:

```sh
npm test
npm run check
npm run dev
```

Open http://127.0.0.1:4173/. Optional isolated origin: `npm run dev -- --port 4174`.
The server never runs inference. Existing Service Workers may retain an older build; use explicit update/close/reopen or a separate localhost port rather than deleting existing data.
For physical iPhone PWA tests, use a secure top-level HTTPS origin. A LAN HTTP URL is not equivalent.

## Verification

```sh
npm test
npm run check
npm run test:markdown
npm run test:prototype
npm run build:prototype
```

See [measured results and outstanding gates](docs/TEST-RESULTS.txt). Node/source checks and phone simulations do not establish usable GPU inference, real IME, accessibility compliance or offline cold restart.

## Repository map

- `dist/`, `tests/`, `scripts/`: baseline PWA, core tests and localhost server.
- `design/prototype/`: portable accepted UI source, dependency lockfile and protected phone runtime.
- `docs/PRODUCT-SPEC.md`: current product/UI/storage/tool/scheduling decisions.
- `docs/IMPLEMENTATION-PLAN.md`: work remaining to integrate the MVP.
- `docs/STORAGE-CONTRACT.md`: actual baseline persistence/export contract and accepted changes still pending.
- `docs/design/`: selected browser screenshots, with their validation limits.
- `research/`, `dist/model-manifest.json`: upstream metadata and pinned baseline asset identities.
- `specs/pending/`: historical acceptance seeds; the Markdown seed now passes.

No model weights, downloaded inference runtime, private user notes or credentials are included. Baseline notes/settings are in IndexedDB and model/runtime assets in OPFS. The third-party inference runtime's redistribution license remains unresolved. No deployment is performed by this handoff.

Attachment/decision processing contracts and current UI limits: [MEDIA-HARNESS.md](docs/MEDIA-HARNESS.md). Multi-attachment preview can read bounded TXT/MD originals; media analysis and persistent asset storage remain unconnected.

Browser storage is origin-specific: 4173, 4180 and 4181 do not automatically share IndexedDB. Use local backup/restore to transfer between origins. The adapter uses the existing mlb-memory-v1 schema without clearing it. The 4180 development server now serves repository source, not the older outputs copy.
