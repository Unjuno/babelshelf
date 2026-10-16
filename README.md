# BabelShelf — local development handoff

Experimental local-first notes and Bonsai 2 PWA. **Not a verified completed app.**

## Run locally

Requirements: Node.js 22 or newer. Python, npm installs and Sites are not required.

```sh
git clone https://github.com/Unjuno/babelshelf.git
cd babelshelf
npm test
npm run check
npm run dev
```

Open http://localhost:4173 in your browser. The server binds to 127.0.0.1 only.
A browser with a working WebGPU adapter is required for inference. The server never
runs a model. On-device model code and weights are downloaded explicitly by the app.

For an iPhone, serve `dist/` over a real top-level HTTPS origin. Plain HTTP on your
computer's LAN address is not a replacement for the secure-context/PWA test.

Existing Service Workers can keep serving an earlier build. Use the app's explicit
Check for updates operation and close/reopen. For isolated development tests, a new
localhost port gives a separate storage origin without deleting existing note/model data:

```sh
npm run dev -- --port 4174
```

## Current status

- 31 Node tests pass. These are core behavior and source checks, not a browser/GPU pass.
- Last deployed source baseline: `42c93c635827aec6d4c9b4f0d8679b9a5f838eb6`.
- This portable handoff adds the local server and latest requirements/pending tests.
- Current UI still has two primary destinations. **The requested sidebar-free,
  single-input / Markdown-tree interface is NOT implemented.**
- Real Bonsai load/generation/stop, Safari/iPhone and all-feature offline cold start
  have not been verified. Earlier remote Chrome returned no WebGPU adapter.
- Internal preview failed because bwrap could not mount proc. No rendered UI pass is claimed.
- The exact pinned runtime is NOT redistributed: its runtime-specific license is unresolved.
  It is fetched directly from upstream during explicit model preparation. See `dist/LICENSES.txt`.
- `dist/model-manifest.json` pins model/runtime revision, size and SHA-256.

## Next implementation target

Read `NEXT-REQUIREMENTS.md` first. It supersedes earlier UI decisions in the history.
The unfinished Markdown acceptance tests are isolated from the passing default suite:

```sh
npm run test:markdown
```

That command is EXPECTED TO FAIL until files.js and versioned paths are implemented.
It is a specification seed, not a pass or completed feature.

## Repository

Public source: https://github.com/Unjuno/babelshelf

The repository contains no model weights, third-party runtime bundle, personal notes,
Git credentials or Sites project identity. For the accepted next UI, start with
`NEXT-REQUIREMENTS.md`. The current app is an experimental baseline, not the final interface.

## Files

- `dist/`: static PWA source/build (plain HTML/CSS/ES modules)
- `tests/`: passing Node tests; `scripts/check.mjs`: syntax/DOM/model pin/asset checks
- `scripts/serve.mjs`: localhost-only development static server
- `specs/pending/`: unfinished acceptance tests, deliberately excluded from `npm test`
- `docs/TEST-RESULTS.txt`: measured versus unverified results
- `docs/IMPLEMENTATION-HISTORY.md`: earlier design/implementation notes (not latest UI spec)
- `research/`: public upstream metadata/licenses; no model weights/runtime bundle

Notes/settings stay in IndexedDB. Weights/runtime stay in OPFS. Neither is included in
this source archive. `.brainpack` exports notes and provenance, not model weights.
