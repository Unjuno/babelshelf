# Tool packages — current user direction

The user's latest direction is executable code paired with a SKILL.md usage file, not Markdown-only tool descriptions or JSON-only definitions. The basic package is SKILL.md plus implementation code. Code can export its argument schema and entry points. A separate machine-readable manifest is optional when identity/version/capabilities/assets need it; do not force a third file when two suffice. The model reads usage guidance; the harness invokes real code and returns typed results. MCP connection code can be an adapter inside a package. Protocol/browser/runtime compatibility must be verified rather than assumed.

Current Tools/*.md are protected explanatory records; actual native tool handlers live in application code. Do not represent a new Markdown/JSON document as an installed executable adapter. Keep existing records/history during migration. Preserve the accepted Memory/Settings UI and local canonical data.

Registration, inspection, prepared assets and execution must stay distinct. Model/document/SKILL content does not grant code-installation, writes, network or future execution permission. Initial packages should wrap the actual connected local search/read/reviewed-capture/correction handlers and preserve their typed inputs/results/approval/CAS behavior. Installing new implementation code is different from adding a definition. Ordinary usage remains offline; no implicit fetch, external personal-data upload or cloud/LAN inference.

This records the architectural direction from the conversation. It is not an implemented plugin loader, verified sandbox, MCP server/client or permission boundary. PWA host capabilities, package execution isolation and MCP transport roles need concrete design and verification before claiming support. No legacy data deletion, arbitrary eval of Memory documents or automatic imported-code execution.

## Unit75 — first executable packages

Plan and acceptance: extract the existing explicit search/read handlers into bundled code with SKILL.md; preserve canonical snapshots, structured activity, revision references and cancellation. Check argument rejection, real host results and cancellation before/after awaiting the host, then build and inspect the ordinary browser route.

`src/tools/memory.search` and `memory.read` now pair tool.ts with SKILL.md. Normal explicit search and exact read dispatch call these implementations, recording package identity/version in activity. Current-file pinned reads retain their separate version validator. These are trusted bundled modules, not installed user code. No new authority or network capability is introduced.

Memory code projection, package registration/isolation, custom code installation and MCP adapters remain unimplemented. Existing Tools Markdown/history is preserved; this step does not represent it as executable source.

## Unit76 plan — inspectable bundled source

Project bundled SKILL.md and TypeScript source into protected canonical Tools package records from Vite raw imports of the same compiled inputs. Include the shared host dependency. These are IndexedDB text records, not installed OS files; the application executes bundled modules, never imported text. Add narrow Tools package .ts paths to the storage format, keep ordinary user creation Markdown-only, and export source bytes without Markdown frontmatter. Existing IDs/history remain. Verify tree/read protection, source equality, raw export and backup/reopen. Prior app versions may reject these new source paths; no backward-client compatibility claim. Custom installation/MCP remains pending.
