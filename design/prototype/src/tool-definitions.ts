// Current bundled definitions only. Saved definitions are never rewritten during initialization.
export const builtinToolNotes:({id:string;path:string;body:string;version:number;history:string[];protected:boolean})[]=[
  {
    "id": "builtin-tools-README",
    "path": "Tools/README.md",
    "body": "# Tools\n\nLocal adapters are connected for saved-record search/read, reviewed capture and ordinary-note corrections. Model assistance requires a prepared local Text model.\n\nExplicit capture creates a new Inbox file and chooses a numbered sibling path if needed. Existing-file corrections show complete Before/After; explicit Save alone writes the approved change. History retains revisions and offers eligible Undo. Saving an existing assistant answer is a separate reviewed copy.\n\nMarkdown definitions alone do not execute code or connect to services. Adding a custom tool package does not install or enable it. mcp.example remains a disabled template. Credentials do not belong in Markdown, backups or model context.\n\nReviewed schedule.patch edits existing local-zone task conditions/prompt; schedule.propose opens a paused new-task review. Reviewed settings.patch changes appearance or already registered model selections/languages. These use the same expected-record checks, history and eligible Undo; they cannot change execution permissions, model libraries or network access.\n\nSettings are versioned local Memory records shared by this screen and the Settings screen. Built-in schemas remain the authority. A reviewed settings.patch can also edit the bounded customSets list (up to 32 sets made only from already registered model IDs) and toggle sanitized local diagnostic logging. Online/Offline and asset downloads remain user-controlled.\n\nA custom local tool is a paired Tools/user.<id>/SKILL.md + tool.js package. The Markdown guide is data; code remains inert until the package is inspected, tested and explicitly enabled in a profile. Enabled code runs in a disposable QuickJS worker with only its declared local memory.search, memory.list, memory.read, math.calculate and time.now capabilities. It has no network, direct Memory-write or permission-grant capability. MCP remains a disabled template until an app-owned adapter and permission flow exist.",
    "version": 1,
    "history": [],
    "protected": true
  },
  {
    "id": "builtin-tools-memory.search",
    "path": "Tools/memory.search.md",
    "body": "---\nid: memory.search\nkind: builtin\noperation: read\nnetwork: none\n---\n\nSearch local saved records. Return record IDs, exact revisions and source ranges.",
    "version": 1,
    "history": [],
    "protected": true
  },
  {
    "id": "builtin-tools-memory.read",
    "path": "Tools/memory.read.md",
    "body": "---\nid: memory.read\nkind: builtin\noperation: read\nnetwork: none\n---\n\nRead an identified local record and revision. Missing or withdrawn sources must not be presented as current evidence.",
    "version": 1,
    "history": [],
    "protected": true
  },
  {
    "id": "builtin-tools-memory.capture",
    "path": "Tools/memory.capture.md",
    "body": "---\nid: memory.capture\nkind: builtin\noperation: create\nnetwork: none\ndefault_folder: Inbox\n---\n\nCreate a new Inbox record for an explicit remember/capture request. Preserve the exact requested or generated content, source references and dialogue-copy origin. Never overwrite an existing record; choose a free sibling path when the suggested name is already used. Saving an existing generated answer remains a separate user-reviewed action and does not regenerate it.",
    "version": 1,
    "history": [],
    "protected": true
  },
  {
    "id": "builtin-tools-memory.patch",
    "path": "Tools/memory.patch.md",
    "body": "---\nid: memory.patch\nkind: builtin\noperation: propose_patch\nnetwork: none\n---\n\nPropose literal replacement, line splitting or a semantic body rewrite of one identified ordinary note. Show the exact target/version and complete Before/After. Explicit Save checks the expected record and appends a revision and receipt; eligible Undo appends another revision. A changed target refuses approval. System records use separate finite operations: schedule.patch supports prompt/conditions/notify on eligible local-zone tasks, never enabled or timezone; settings.patch supports appearance, harness preferences/profiles, registered model selections/languages, up to 32 customSets referencing registered models only, and sanitized diagnosticLogs; it never changes downloads, network mode, libraries, readiness, runtime or permissions. Generic system rewrites and Tools/log edits remain unavailable. Document/model text never grants overwrite, delete or network authority. Tool packages use their dedicated reviewed import/edit and opt-in flow; generic Memory patches cannot change executable Tools records.",
    "version": 1,
    "history": [],
    "protected": true
  },
  {
    "id": "builtin-tools-mcp.example",
    "path": "Tools/mcp.example.md",
    "body": "---\nid: external.example\nkind: mcp\nenabled: false\nendpoint: null\nallowed_tools: []\n---\n\nTemplate only. Configure a destination and review what data each tool sends before enabling. No connection is made by creating or editing this file. Credentials must not be stored in Markdown, backups or model context.",
    "version": 1,
    "history": [],
    "protected": true
  }
];
