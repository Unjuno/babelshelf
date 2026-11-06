import test from 'node:test';
import assert from 'node:assert/strict';
import {CUSTOM_TOOL_CAPABILITIES} from '../src/custom-tool-types.ts';
import {builtinToolNotes} from '../src/tool-definitions.ts';

test('current built-in definitions describe local tools without granting arbitrary writes',()=>{
 const byId=Object.fromEntries(builtinToolNotes.map(note=>[note.id,note]));
 const readme=byId['builtin-tools-README'].body,patch=byId['builtin-tools-memory.patch'].body;
 assert.doesNotMatch(readme,/tool execution is not connected/);assert.match(readme,/local adapters/i);assert.match(readme,/do not execute|do not connect/i);
 assert.match(patch,/rewrite/i);assert.match(byId['builtin-tools-mcp.example'].body,/enabled: false/);
 assert.match(patch,/schedule.patch/);assert.match(patch,/settings.patch/);assert.match(patch,/enabled.*timezone/);assert.match(patch,/Tools.*unavailable/);
});

test('capture is add-only and saving a generated answer stays a separate reviewed action',()=>{
 const byId=Object.fromEntries(builtinToolNotes.map(note=>[note.id,note]));
 assert.match(byId['builtin-tools-memory.capture'].body,/operation: create/);assert.match(byId['builtin-tools-memory.capture'].body,/Never overwrite an existing record/);assert.match(byId['builtin-tools-memory.capture'].body,/separate user-reviewed action/);
 assert.match(byId['builtin-tools-README'].body,/Explicit capture creates a new Inbox file/);assert.match(byId['builtin-tools-README'].body,/Saving an existing assistant answer is a separate reviewed copy/);
});

test('current Memory settings and custom tool packages document their actual limits',()=>{
 const byId=Object.fromEntries(builtinToolNotes.map(note=>[note.id,note]));
 const readme=byId['builtin-tools-README'].body,patch=byId['builtin-tools-memory.patch'].body;
 assert.match(patch,/customSets/);assert.match(patch,/registered model/i);assert.match(patch,/Tool packages/);assert.match(patch,/diagnosticLogs/);assert.match(patch,/never changes downloads, network mode/i);
 assert.match(readme,/Tools\/user\.<id>/i);assert.match(readme,/QuickJS/i);assert.match(readme,/explicitly enabled in a profile/i);assert.match(readme,/network.*write/i);assert.match(readme,/sanitized local diagnostic logging/i);assert.match(readme,/remain user-controlled/i);
 for(const capability of CUSTOM_TOOL_CAPABILITIES)assert.ok(readme.includes(capability),`Tools guide must describe registered custom capability ${capability}`);
 assert.match(readme,/no network, direct Memory-write or permission-grant capability/i);
});

test('only current defaults ship; historical source snapshots are not bundled',()=>{
 assert.equal(builtinToolNotes.length,6);
 assert.ok(builtinToolNotes.every(note=>note.version===1&&Array.isArray(note.history)&&note.protected));
});
