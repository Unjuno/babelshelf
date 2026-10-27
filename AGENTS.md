# Repository working agreement

Updated 2026-10-21. This file is the current operational guide. Historical experiments and dated release observations are preserved in `docs/history/AGENTS-2026-10-21.md`; they are evidence from their stated builds, not live instructions.

## Start here

- Read `NEXT-REQUIREMENTS.md` for current product invariants and next work.
- Read `docs/PRODUCT-SPEC.md` and the relevant sections of `docs/ARCHITECTURE.md` for behavior and boundaries; consult `docs/ARCHITECTURE-REVIEW.md` for structural gaps.
- Read only the `Current status` block at the top of `docs/REMAINING-GATES.md` for the current release snapshot. Search `docs/TEST-RESULTS.txt` for a specific build, feature, or test ID; do not load the full historical log.
- Treat `docs/MVP-ACCEPTANCE.md` as the acceptance matrix, not a substitute for current-build evidence. Keep detailed dated run evidence in `docs/TEST-RESULTS.txt`; link to it instead of copying it into status/requirements documents.

## Product invariants

- BabelShelf is a local-first PWA. Knowledge, originals, revisions, prompts, and inference remain on the user's device. Offline use must not trigger silent network fallback or asset acquisition.
- IndexedDB is canonical storage; the Markdown hierarchy is a projection. Preserve originals, IDs, revisions, withdrawals, source ranges, and backups. Never reset or purge user data to make a test pass.
- Model and tool choices are registries, not proof of runtime support. Verify the pinned model/runtime pair before reporting it runnable. Keep model changes explicit and preserve the user's selected defaults.
- Models may propose edits to user configuration or knowledge, but the app must validate, preview, and require approval before committing changes. Keep history and compare-and-swap checks.
- Tool code and SKILL.md are separate. Tool definitions cannot grant capabilities. Custom code remains a constrained, untrusted local extension; do not claim the browser/QuickJS boundary is invulnerable or that it supports arbitrary MCP transports.
- Keep the accepted mobile UI unless the user asks to change it. Favor real task-flow improvements over superficial restyling.

## Engineering and verification

- Make focused, reviewable changes that improve the user-facing system. Preserve unrelated working-tree edits; do not stage or commit broad dirty trees.
- At each coherent milestone, review architecture and repository organization: identify duplicated behavior, unclear ownership, stale instructions, and oversized source or test files. Refactor only where it reduces duplication or coupling; preserve contracts and avoid unrelated rewrites. Prefer updating the existing canonical document over adding another status or memory file.
- Keep a short current-state summary separate from append-only evidence. Historical evidence may be moved to its canonical archive, but never silently deleted or copied into multiple active summaries. Read only the relevant sections needed for the current task.
- Run the narrowest relevant tests plus required regressions. Report the actual environment and scope: Node, PC browser, installed PWA, physical iOS/Android, and model/GPU acceptance are distinct.
- Do not use mocked inference as evidence of model behavior. Do not repeat broad experiments when existing evidence answers the question; collect new measurements only to resolve a concrete uncertainty.
- The Settings > Developer iOS handoff is a one-run device check. The PWA cannot verify iOS Airplane Mode or force-close. Copy its bounded report/context and analyze it before requesting a repeat.
- Preserve Site audience. Public deployment to the existing BabelShelf Site is authorized; build and verify the exact artifact before deployment. Keep GitHub changes on the existing `codex/ui-design-handoff` branch; do not update `main`.
- Keep downloaded models, browser profiles, device-test results, generated bundles, and packaging archives local unless a specific tracked artifact is required. Never commit credentials or private user data.
- Clean up agent-generated artifacts as part of each task. Reuse one staging directory and one current package instead of accumulating versioned copies; retain the latest delivery archive and small reports needed to explain results. Remove obsolete staging copies and archives after checking their resolved paths and ownership. Preserve source changes, Git metadata, models, originals, browser storage and diagnostic evidence. Reuse one preview server/origin; stop only servers created by this task when no longer needed.

## Local development

From the repository root:

```sh
npm --prefix design/prototype ci
npm run build:app
npm run dev:app -- 4180
```

The app is available at `http://127.0.0.1:4180/`. Inspect the active `build.json` when an older service worker may be serving a prior build; do not clear browser storage to force an update.
