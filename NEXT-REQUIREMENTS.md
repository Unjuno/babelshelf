# Current requirements and next work — 2026-10-17 JST

The accepted specification is [docs/PRODUCT-SPEC.md](docs/PRODUCT-SPEC.md). It supersedes the earlier bottom-toggle UI brief and chronological design notes.

## Accepted interface

- One natural-language input/results surface, compact photo/voice/Send controls; no sessions, branding header, sidebar, hamburger or bottom tabs.
- Upper-left glass Input button. Touch/pen tap returns to Input. Mouse/trackpad click opens a persistent menu, a destination click selects, and clicking Input again returns to Input. A touch/pen 50ms hold reveals a curved Memory / Schedule / Notifications / Settings menu; slide and release selects. Stationary release closes the menu and returns to Input. Touch/pen has no release-then-tap menu; mouse navigation intentionally stays open after click. Keyboard/screen-reader alternatives remain.
- Memory starts at Home: Inbox, Notes, Files. Navigate folders and breadcrumb ancestors. Internal Schedule/Notifications storage is visible only on explicit upper-level navigation.
- Protected storage roots, at most five stored folder levels, direct correction and retained history. Home is a display grouping; Files labels Attachments.
- English controls, multilingual content, readable text, large targets, glass model-choice sheets, no instructional paragraphs.
- Separate Text and Decision role selection/preparation. Bonsai 2 4B/2B retained; Open d1 Omni 600M/3B are decision candidates, not installed runtimes.

## Current integration and remaining gates

The accepted UI uses the existing canonical IndexedDB store. Memory, preferences, foreground schedules/execution records/notification events, continuous dialogue, reviewed ordinary-note correction/Undo, durable originals and full-state brainpacks are connected. Local Bonsai 4B, Whisper tiny, PDF text layers and PNG/JPEG OCR have scoped PC browser evidence in docs/TEST-RESULTS.txt. Unit18 adds reviewed image/PDF Use text and atomic Send alongside TXT/MD, with canonical source marks; see docs/INPUT-READINGS.md. Unit19 adds automatic prepared image/PDF/audio/video-audio reading on Send, with truthful extraction/coverage status and the same atomic storage. The projection is not disk-backed Markdown files.

Remaining work must preserve the full product objective:

1. Scanned PDF OCR, general image/video-frame understanding and verified video-container timing; retain originals, bounded coverage and processor provenance. Current OCR Japanese sample contains errors.
2. Decision and compatible custom model/runtime adapters require their own pinned artifacts, compatibility and license verification. Candidate registration is not execution support; no provider/cloud fallback.
3. Generic settings/tools/tasks model edits require typed reviewed patches and exact expected versions. Current semantic ordinary-note correction is source-only; attaching a file does not expand its factual rewriting authority.
4. Broader multilingual relevance/semantic accuracy, large archives/history retention, divergent-history reconciliation and storage pressure. Current bounded tests are not universal accuracy/capacity evidence.
5. Physical Android/iPhone touch, microphone/camera, GPU/resource limits and accessibility. PC browser and simulated phone frame are separate evidence.
6. Whole-browser/installed-PWA process shutdown and fully isolated offline restart across every normal function. Server-unavailable fresh tabs prove only that narrower scope. Closed-PWA timed execution/OS notification delivery is not guaranteed.

## Evidence boundaries

Run baseline Node/Markdown, prototype tests/build, product-shell tests and protected-runtime checks separately. Actual browser storage, actual model generation and physical-device results must name their build and scope. Never clear existing databases, use mock inference as acceptance or mark the whole MVP complete while required gates remain unverified. Historical bwrap/no-adapter results remain historical environment results, not evidence against Bonsai.
