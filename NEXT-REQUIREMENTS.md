# Latest product direction — 2026-10-17 JST

Priority: the user's latest instructions supersede all earlier UI layouts.

## Intended product

A local GBrain-like knowledge interface, not a chat product with separate Chat/Notes tabs.
One central input and Send. Natural language can retrieve/read/summarize knowledge and
prepare new notes. Model knowledge is not the source of truth. The stored Markdown is.

## Required UI

- No sidebar. No Chat label or Chat navigation concept.
- English UI labels, unrestricted multilingual user text and model output.
- No instructional paragraphs, taglines, marketing copy or explanatory onboarding.
- Keep readable text and large primary hit targets; reduce visible control count.
- A bottom toggle switches between the input/results surface and a hierarchical Markdown view.
- Markdown structure must be visible as folders/files, not a flat note list.
- Open a Markdown file, inspect its original contents, and correct the relevant place directly.
- Corrections create a retained revision. Do not silently overwrite or delete prior sources.
- Settings contains model selection/preparation and online/offline update permission.
- The network toggle must continue to default OFF. ON never permits remote inference or
  transmitting personal notes/questions/answers.

## Work still required

1. Versioned Markdown paths and hierarchy; distinguish real stored structure from a visual
   projection. Decide and document whether canonical records stay in IndexedDB with a
   faithful file projection or become real local Markdown files. Do not claim OPFS files
   already exist when they do not.
2. Implement a safe rename/move contract, no traversal/duplicate overwrite. Path changes
   and text edits must preserve IDs, versions, withdrawal and provenance/backup integrity.
3. Replace existing navigation with a single input and the bottom Markdown toggle.
4. Route natural-language capture/search/read/new-note previews through bounded actions.
   Current planner is search-oriented; arbitrary note creation intent is NOT yet complete.
5. Preserve approval before creating derived notes and explicit user editing for corrections.
6. Test real DOM/IME/keyboard/touch layouts on the actual app. Existing source checks must
   be updated for the new UI and must not be presented as proof of usability.
7. Load/generate/stop with actual Bonsai 2 4B, then 2B if needed, verify full asset retention
   and offline cold restart on target iPhone. No canned answers or alternate cloud/model fallback.

## Existing acceptance seed

`specs/pending/markdown.acceptance.mjs` was written before the handoff. It currently fails
because `dist/files.js` and versioned paths do not exist. The application has not been
changed to pretend those features work. Treat the seed as incomplete, not a full acceptance suite.

## Known risks

- Real inference and iPhone support not established.
- Third-party inference runtime redistribution license not clarified.
- Existing UI may be retained by old offline caches until explicit update/close/reopen.
- Current note backup does not include derived conversation history or model assets.
- Existing local data must not be purged as a shortcut during redevelopment.
