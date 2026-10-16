# Mobile Prototype Agent Guide

## Prototype Instructions

In ChatGPT Work Mode, run `sites-preview start "$PWD"`, open `http://terminal.local:4173/` in the cloud browser, and verify the rendered app and its primary interactions. Keep that preview open and tell the user to inspect it in the cloud browser; do not present the local URL as a user-facing chat link. In Codex Desktop, run the local server yourself, open the preview in the in-app browser, and provide the clickable local URL. Do not deploy to Sites unless the user explicitly asks to share, publish, or deploy. Do not give the user server-start instructions when you can run it.

Before planning or implementing any mobile-app change, read this `AGENTS.md` in full. It is the source of truth for the template's runtime and component guidance.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Editing Boundary

- Build app-specific UI in `src/Prototype.tsx` and `src/prototype.css`.
- Treat `src/App.tsx`, `src/main.tsx`, `src/styles.css`, `src/mobile/`, `public/assets/iphone/`, `public/assets/android/`, `public/assets/status/`, `vite.config.ts`, `worker/index.js`, and `scripts/prepare-sites-build.mjs` as protected runtime files. Do not edit, replace, remove, or recreate them unless the user explicitly asks to change the mobile runtime itself. For an explicit runtime change, update the affected lock hashes only after verifying the new runtime behavior.
- Run `npm run check:runtime` before preview or handoff. If it fails, restore the protected runtime instead of weakening or bypassing the check.
- `npm run build` preserves the mobile runtime and prepares the static Cloudflare Worker output required by Sites. Before a Sites handoff, confirm `dist/client/index.html`, `dist/server/index.js`, `dist/.openai/hosting.json`, and source `.openai/hosting.json` exist, then run `npm run test:sites`. Do not replace this project with a Vinext starter.

## Runtime Contract

- Preserve the mobile device runtime unless the user's task explicitly asks otherwise. Do not replace it with a standalone page. Visual fidelity applies to app-owned content inside the device screen, not to template-owned device chrome.
- Keep `App` composed around `PhoneFrame` -> `KeyboardProvider`, with `StatusBar`, app content, `HomeIndicator`, and `KeyboardDock` mounted inside the phone frame. `StatusBar` and the iOS home indicator are overlaid device chrome. When the Android keyboard is closed, the app viewport reserves the protected navigation-bar region instead of painting behind it. When the Android keyboard is open, preserve the current full-screen keyboard layout: its asset includes the IME navigation strip and the separate black navigation bar is hidden. iOS screens continue to paint behind the home-indicator area and own their safe-area content padding.
- Preserve the `iPhone` / `Pixel 10` device picker and both calibrated device presets. The Pixel screen is `427 x 952`; its `32 x 32` camera circle and `public/assets/android/navigation-bar.svg` bottom navigation bar are protected device chrome, not app content.
- Preserve the device picker's intentionally lightweight Codex styling in the top-right corner: its trigger wrapper is borderless and transparent, its trigger sizes to content, and its right-aligned menu uses the compact 3px inset plus the specified hairline and elevation shadow layers. Keep the prototype root and default app screen white.
- Preserve `StatusBar` as live device chrome, including its platform-specific typography, source status-icon assets, and spacing. Pixel 10 uses Roboto, Android indicators, and 32px top, left, and right padding. iPhone uses its iOS indicators, system typography, and calibrated spacing. Do not hardcode screenshot times like `9:41` into the status bar, replace its real-time clock, or move status bar content into app markup unless the user explicitly asks for a fixed/mock device time.
- `PhoneFrame` owns the calibrated device frame, screen portal, device picker, camera cutout, and custom cursor. Keep device assets in `public/assets/iphone/` and `public/assets/android/`; if an asset fails to load, repair the asset path or restore the asset instead of removing the frame, keyboard, or image render.
- Use `MobileScroll` directly for simple single-screen prototypes. Use `FlowStack` for conventional multi-screen flows whose routes can own their fixed header and footer; when using it, define each route as a `FlowScreen`: `{ id, header?, headerHeight?, footer?, footerHeight?, render }`, and use `flow.push(screen)`, `flow.pop()`, and `flow.replace(screen)` from `FlowStack` render callbacks or `useFlow()` instead of introducing another router.
- Use `Carousel` for a carousel, horizontal rail, swipeable cards, image or media strip, horizontally scrollable cards, chip rail, or other horizontal collection.
- For a layered app shell—such as a persistent composer, independently presented sheet, pushed/peek sidebar, or app-wide transition—compose directly in `Prototype.tsx` rather than forcing it through `FlowStack`. Keep app-owned fixed chrome as sibling layers outside `MobileScroll`.
- When using `FlowScreen`, put route-owned fixed headers or footers in `FlowScreen.header` or `FlowScreen.footer`. Set `headerHeight` to the visible app-toolbar height; `FlowStack` adds the device's top safe-area/status-bar inset automatically. Do not include `StatusBar` or its height in the header. Set `footerHeight` to the full app-footer height. `FlowScreen.footer` is an overlay, not reserved layout space; screens using it must add their own bottom content padding such as `padding-bottom: calc(var(--flow-footer-height) + var(--mobile-safe-area-height) + 24px)` so final content can scroll above the footer while still painting behind it.
- Render only scrollable content inside `MobileScroll`; it is for content that should move with scroll and rubber-band overscroll. Keep app-owned headers, nav bars, tabs, composers, and overlays outside it. This keeps scroll physics, safe areas, keyboard insets, scrollbars, and drag click suppression active without letting content paint under fixed chrome.
- Buttons, links, cards, and images inside `MobileScroll` should still allow drag scrolling when the pointer moves beyond tap slop. Use `data-scroll-drag="ignore"` only for rare controls that must own the drag gesture themselves.
- Do not add `var(--keyboard-height)` to ordinary screen/content padding inside `MobileScroll`; the scroll viewport already shrinks above the simulated keyboard. For custom fixed composers, search bars, or toast chrome, use `useKeyboardInsets().bottomInset`. It is relative to the app viewport: Android returns `0` while the closed-keyboard viewport already reserves navigation, then returns the keyboard height while open; iOS continues to clear the home indicator while closed and ride directly above the keyboard while open. Do not pin custom bottom chrome to `bottom: 0` or only `keyboardHeight`.
- Use `KeyboardInput`, `KeyboardTextarea`, or `MobileTextField` for every text-entry control. A raw `input` or `textarea` disconnects focus, keyboard animation, safe-area insets, and attached surfaces.
- Use `BottomSheet` for phone-scoped sheets. Its props are `open`, `onOpenChange`, `title`, optional `description`, optional `snap`, and `children`; it renders through the phone screen portal and dismisses the keyboard before opening.

## Horizontal Carousels

- Use `Carousel` for horizontally draggable cards, images, media, chips, or other horizontal collections. Do not recreate these with `overflow-x`, custom pointer handlers, or a generic div.
- `Carousel` can be nested directly inside `MobileScroll`. It owns horizontal gestures and automatically yields vertical gestures to the parent.
- Never put `data-scroll-drag="ignore"` on or around a `Carousel`; doing so prevents vertical parent scrolling when a gesture begins inside it.
- Do not add CSS scroll snapping to `Carousel`; its runtime owns momentum and release motion.
- Use `data-scroll-drag="ignore"` only when a control must prevent parent scrolling in every drag direction.

See `src/mobile/COMPONENTS.md` for the full component and gesture contract.

## Keyboard Rule

The simulated keyboard is a separate top-layer component. Before presenting anything that behaves like iOS navigation or modal UI, dismiss it first.

Call `keyboard.hide()` before:

- pushing, popping, or replacing FlowStack routes
- opening bottom sheets, action sheets, dialogs, menus, or navigation sheets
- starting transitions where the destination should not inherit text-input focus

`FlowStack` already hides the keyboard for `push`, `pop`, and `replace`. `BottomSheet` already hides it before opening. If you add new modal/sheet/navigation primitives, follow the same rule.

When a composer, search surface, or other keyboard-attached component closes, call `keyboard.hide()` in the same event before changing that component's open state. Position attached surfaces from `useKeyboardInsets()` rather than a separate timer or visibility flag so both dismiss together.

When any text-entry control loses focus, dismiss the simulated keyboard. If the control is custom or does not use the runtime's keyboard-aware fields, handle its blur event and call `keyboard.hide()` explicitly. Keep the keyboard open only when focus is moving directly to another text-entry control that should share the same keyboard session.

## Interaction Rules

- Do not trigger buttons or inputs after a pointer has become a drag. Preserve the drag suppression behavior in `MobileScroll`.
- Do not allow native browser image/file dragging inside the phone frame. Preserve the phone-level `dragstart` suppression and non-draggable image styles so scroll drags that begin on images still scroll the prototype.
- Use `KeyboardInput`, `KeyboardTextarea`, or `MobileTextField` for text entry so the simulated keyboard and safe-area insets stay connected.
- Fixed phone chrome should not animate with pushed screens. Screen content can animate; the status bar, camera cutout, and preview chrome should stay put.
- Keep the keyboard below the home indicator/safe area layer in z-index, and above ordinary app UI while visible.
- Keep the home indicator as the topmost safe-area layer in the z-index above everything else in the prototype.

## Accepted product direction

Read ../../docs/PRODUCT-SPEC.md for current product decisions. This prototype is the accepted surface reference, not a persistent knowledge engine.

- No branding header, sessions, sidebar, hamburger, bottom navigation or instructional paragraphs. English controls; multilingual user content.
- Main input with compact photo, microphone and Send. The initial exchange is a static design example; do not fabricate inference.
- Upper-left clear glass Input button. Short pointer tap returns to Input. Hold 50ms to reveal curved Memory / Schedule / Notifications / Settings. Slide and release selects; stationary release closes and returns to Input. Returning to center/outside cancels after movement. Keep keyboard/screen-reader alternatives and no decorative line.
- Memory defaults to Home (Inbox, Notes, Files); Files labels Attachments. Click folder rows and breadcrumb ancestors. Explicit Memory ancestor reveals internal Schedule/Notifications. Initial canonical roots are protected and stored depth is at most five; Home adds no stored level.
- Direct editor/history, same Cancel/Save creation sheets. Existing preview records are never erased to change presentation.
- Separate Text and Decision model roles. Bonsai 2 4B/2B; Open d1 Omni 600M/3B candidate selections. Glass choice sheets, not native model select popups. Selection never claims preparation or execution.
- All preview data is transient React state. No downloads, inference, real schedules, notifications, backup integrations or permission prompts.
- Sheet material and z-order use the persistent Input anchor, not the conditionally mounted arc. Device chrome/keyboard remain protected template infrastructure.
- For meaningful changes run node --test tests/memory-paths.test.mjs tests/memory-navigation.test.mjs and npm run build. Browser simulation is not physical-device evidence.
- Favicon is a completely blank white square/paper, with no glyph, text, folded corner or branding.

## Item actions and recovery

- Fixed canonical folders and Home are protected. User files/folders expose 450ms long press and an accessible Actions button. Files: Edit / Delete; folders: Rename / Delete. Confirm target/counts and retain exact records/revisions. Undo/Restore refuse conflicts.
- Trash belongs in Settings > Local files, with explicit Restore and item counts; Memory header contains only creation +. Recovery is transient in the prototype, with no permanent purge or storage reclamation claim.
- Compact navigation uses 75px radius and a 110-degree sweep with 44px secondary targets; Input remains 72px with a separate 50ms hold.

## Attachments and settings

- Multi-attachment +, per-item original preview/status/removal, sent text+attachments stay grouped. TXT/MD reading is real and bounded to 1 MiB; audio/video use browser playback. No generated answers, OCR/transcription or unsupported-format extraction is simulated. Revoke object URLs on removal/unmount.
- Media readiness is explicit Not prepared; no unconnected Prepare buttons. Appearance System/Light/Dark, Paper/Sage/Sand, Clear/Frosted and Reset are transient UI settings. Keep protected black device indicators readable.
- Notifications open detail, mark read and link to current schedule. Deleting only removes the notification event. Save receipts must say execution is not connected. Canonical Memory-backed notification persistence is pending.

- Shared defaults and catalogs live in src/app-settings.json, validated by app-settings.ts. Never put ready/installed claims, runtime URLs, executable tools or permission escalation into settings. See docs/SETTINGS-CONTRACT.md.

## Attachment source choice

On a fine-pointer desktop, composer + opens multi-file selection directly. On primary coarse-pointer devices it opens the common glass sheet: Take photo / Choose files / Cancel. Photo uses a separate single image input with capture=environment; file selection stays multiple and does not request capture. Both feed the same attachment inspection/removal/send path. Native camera behavior depends on the browser/device and requires physical-device verification; the phone preview preset alone is not hardware detection.

- Speech to text has an independent session-only catalog and selector (Whisper tiny/base multilingual candidates). Adding a candidate does not download assets or run recognition. Prepare is disabled until a verified adapter exists; mic links to settings. app-settings schema 2 validates the new role.

- Scheduled work is a prompt: New/Edit schedule uses a multiline Prompt with exact body preservation, not a title-only task. List heading derives from the first line; notification receipts retain the prompt. Repeat uses the same app-owned glass choice sheet (Every day/Every week) with draft-preserving return/Cancel; no native select menu. Execution and canonical persistence remain unconnected.

- Tools is a protected sixth canonical root, outside Home, with read-only bundled definitions and a disabled MCP template. User definitions are inactive data; file creation never enables execution/network. Keep built-in IDs/protection separate from user-authored frontmatter. app-settings schema 3 includes Tools.

- Settings is the seventh protected root (schema 4). Managed settings file IDs/paths are immutable but values are editable and validated. Derive control values only from preference-records.ts records; do not recreate parallel React preference state. Keep short Settings categories, folder/Open file links and append-only revisions. UI records are still session-only.

- UI-review fixes: fixed editor actions above keyboard; task sheet has scrollable fields and pinned actions; source/Send 44px; dark readiness contrast; Fixed path vs read-only distinction; unread badges; unavailable Prepare buttons disabled. Keep approved 50ms hold and short hint, pending physical-touch evidence.
- ReferenceCard shares text excerpt/image/video/audio previews across citation example and sent originals. Example citation pins v1. Attachments are not generated citations. Weekly schedule now includes weekday and device-zone/next-local-occurrence preview; no runtime execution guarantee.

- Answer citations use compact inline marks only. Show source filenames, original text and media previews on demand after opening the mark; do not add permanent source cards below answers. Dark original text and sheet actions must retain strong contrast.
