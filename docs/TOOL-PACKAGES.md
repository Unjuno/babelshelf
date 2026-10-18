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

Unit76 implemented and verified this projection on product a962b78724805f0a: exact source display, read-only controls, raw export, backup and new offline PC browser process read. See STORAGE-CONTRACT.md for the narrow .ts path extension and retained-snapshot limitation. Code installation, isolation and MCP remain pending.

## Unit79 registry design and acceptance

Centralize trusted bundled module registration with code/SKILL/shared dependency bytes, not Memory-defined registration. A pure registry validates IDs, positive versions, read-only/network-none policy, relative source names, entry/SKILL presence, duplicate IDs and callable entry. Registry owns immutable declaration copies. Compute SHA-256 of canonical identity/version/source envelope; trace exact entry and digest before execution. Dispatch must reject unknown IDs and preserve cancellation before/after awaited host results. The UI uses this registry rather than importing handlers independently. Test hostile declarations, identity changes, rejection/no execution and real canonical host results; native Search/Read must retain source references plus exact package hash in activity. No new code installer, eval, runtime permissions or MCP claim.

Unit79 implemented on28bc57a32331d358/99 assets: immutable trusted module registry; normal explicit read/search use registry.run, and activity includes package ID/version/entry/source-envelope SHA-256. Source envelope contains same raw SKILL.md, tool.ts and tool-host.ts bytes, sorted by deterministic code-unit path order. Hash identifies source inputs, not a proof of semantic behavior or the compiled binary. Native PC actual Search/Read activity hashes equal independently computed Node SHA-256 from workspace bytes; current-build new offline process Read/source export/backup passed. Registry validation is not a sandbox: bundled native handlers remain trusted application code. Untrusted installed code, isolation, custom registration permissions and MCP adapters remain unimplemented.


## Unit208 — exact read identity precedence

The existing OR match mixed exact ID, path and basename hits. Valid imported IDs are arbitrary nonempty strings, so an ID such as archive.md collided with a different note filename and caused the normal read branch to fall back to search. memory.read package v2 resolves exact IDs first, full paths second, and basename matches last. Multiple basename matches remain multiple candidates, never arbitrary first-record selection. Snapshot objects/revisions, cancellation and read-only behavior remain unchanged. Existing projected source records retain history; package identity hashes describe the executing bundled source. This is not custom-code installation or MCP support.

Node regression reproduced two records before the fix, then10/10 tool-package tests passed. Native Chrome real IndexedDB fixture confirms exact ID/path selection and unchanged records. Product UI/cold deployment verification of this new build remains pending.
