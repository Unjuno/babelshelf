# Current requirements and next work — 2026-10-17 JST

The accepted specification is [docs/PRODUCT-SPEC.md](docs/PRODUCT-SPEC.md). It supersedes the earlier bottom-toggle UI brief and chronological design notes.

## Accepted interface

- One natural-language input/results surface, compact photo/voice/Send controls; no sessions, branding header, sidebar, hamburger or bottom tabs.
- Upper-left glass Input button. Touch/pen tap returns to Input. Mouse/trackpad click opens a persistent menu, a destination click selects, and clicking Input again returns to Input. A touch/pen 50ms hold reveals a curved Memory / Schedule / Notifications / Settings menu; slide and release selects. Stationary release closes the menu and returns to Input. Touch/pen has no release-then-tap menu; mouse navigation intentionally stays open after click. Keyboard/screen-reader alternatives remain.
- Memory starts at Home: Inbox, Notes, Files. Navigate folders and breadcrumb ancestors. Internal Schedule/Notifications storage is visible only on explicit upper-level navigation.
- Protected storage roots, at most five stored folder levels, direct correction and retained history. Home is a display grouping; Files labels Attachments.
- English controls, multilingual content, readable text, large targets, glass model-choice sheets, no instructional paragraphs.
- Separate Text and Decision role selection/preparation. Bonsai 2 4B/2B retained; Open d1 Omni 600M/3B are decision candidates, not installed runtimes.

## Next integration gates

1. Connect accepted UI to baseline persistence without resetting or silently migrating user data.
2. Use one canonical record for Memory and each dedicated view. Define schedule, notification rule/event and execution-history records.
3. Add bounded tool patches with expected versions, authorization scope, exact change receipts, history and explicit undo. Existing generated answers are saved without regeneration.
4. Specify schedule metadata: stable ID, timestamp/timezone, recurrence, prompt, enabled flag; filenames are readable labels, not execution authority. Resolve missed runs, repeats and side effects before enabling execution.
5. Verify local Bonsai, then Open d1 compatibility/licensing/assets independently. No cloud/PC/LAN inference substitution.
6. Exercise real browser storage/import/correction/source/backup/restore and real-model load/generate/stop; then full offline restart and physical iPhone/Android usability.

## Evidence boundaries

The baseline currently passes its Node and Markdown seed tests. The accepted UI has separate helper/build checks and desktop-browser simulation evidence. These do not establish end-to-end integration or device/offline/model completion. Historical bwrap/no-adapter results remain historical environment results, not evidence against the models.

Never erase existing data, silently overwrite restore conflicts, retrieve missing normal-use assets without permission, or treat an internal model action as unrestricted write/delete authority.

## Media/notification integration

Follow docs/MEDIA-HARNESS.md. Persist asset/derived/source identities, bounded extraction and read-state events without resetting existing records. UI readiness is not model availability. Integrate appearance persistence separately from personal records.
