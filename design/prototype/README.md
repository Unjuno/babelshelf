# Accepted UI prototype

This is the local interactive design reference for [the accepted product specification](../../docs/PRODUCT-SPEC.md). It is separate from the baseline PWA in ../../dist/.

## Run

Use Node 22.18+ (verified with Node 24.6.0):

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4180
```

From the repository root: npm run dev:prototype. Use a different port if occupied.

## Implemented design interactions

- One input/results surface with compact composer; no sessions or branding header.
- Short Input tap returns to input. Holding 50ms reveals the curved menu; slide/release selects, release without movement closes. Keyboard activation provides an alternative.
- Home-based Memory browser, ancestor breadcrumbs, original reading/editor/history, draft file/folder creation and protected initial roots.
- Separate Schedule and Notifications destinations. Schedule editing is a transient form only.
- Separate Text and Decision role controls, app-owned glass choice sheets and truthful unprepared states.

The initial exchange is static mockup copy. Send appends the user's input only and reports no connected model. Photo selection shows a local preview. Voice, asset preparation, notifications, scheduled execution and backup are not connected.

All notes, changes and settings are React memory and disappear on reload. There is no service worker, model weight, downloaded runtime, real filesystem storage, account, telemetry or remote knowledge processing.

## Memory display contract

| Display | Canonical prototype path |
| --- | --- |
| Memory / Home / Inbox | Inbox |
| Memory / Home / Notes | Notes |
| Memory / Home / Files | Attachments |
| Memory / Schedule | Schedule |
| Memory / Notifications | Notifications |

Home is a navigation grouping, not an account or OS directory. It does not add a stored depth. The five canonical roots are protected; new user items live beneath them, at most five folder levels. Old paths/records are retained. Nothing is moved or copied merely to change the displayed hierarchy.

## Validation and editing boundary

```sh
node --test tests/memory-paths.test.mjs tests/memory-navigation.test.mjs
npm run build
```

Read AGENTS.md before changing this harness. App UI is Prototype.tsx/prototype.css; the device runtime is protected by mobile-runtime.lock.json. The build verifies 28 protected files. Never update lock hashes to conceal unintended runtime changes.

The iPhone/Pixel frames, clock, home indicator and keyboards are template simulations, not hardware evidence. Template runtime and device assets retain their respective upstream terms; they are not covered by a model license. Static hosting build inputs are included only because the template build requires them; this handoff does not deploy anything.
