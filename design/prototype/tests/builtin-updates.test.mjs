import test from 'node:test';import assert from 'node:assert/strict';import {createNote} from '../../../dist/core.js';import {builtinToolUpdates} from '../src/builtin-updates.ts';import {builtinToolNotes,legacyToolBodies,previousToolBodies,knownToolBodies} from '../src/tool-definitions.ts';
const legacy=()=>{const seed=builtinToolNotes.find(n=>n.id==='builtin-tools-README'),n=createNote({path:seed.path,body:legacyToolBodies[seed.id]});return {...n,id:seed.id,ui:{protected:true,managed:false},legacyMetadata:{keep:'原文'}};};
test('recognized protected builtin documentation appends a revision retaining every old byte and unrelated field',()=>{const n=legacy(),before=structuredClone(n),updates=builtinToolUpdates([n],builtinToolNotes);assert.equal(updates.length,1);const u=updates[0];assert.deepEqual(n,before);assert.equal(u.id,n.id);assert.deepEqual(u.revisions[0],n.revisions[0]);assert.equal(u.revisions[1].body,builtinToolNotes.find(s=>s.id===n.id).body);assert.equal(u.revisions[1].version,2);assert.deepEqual(u.legacyMetadata,n.legacyMetadata);assert.deepEqual(u.ui,n.ui);assert.equal(builtinToolUpdates([u],builtinToolNotes).length,0);});
test('unknown, modified, moved, withdrawn, unprotected, managed, imported and historical user variants stay untouched',()=>{const n=legacy(),cases=[{...n,id:'user-note'},{...n,ui:{protected:false}},{...n,ui:{protected:true,managed:true}},{...n,state:'withdrawn'},{...n,aliases:['custom']},{...n,importedFrom:{name:'import.md'}},{...n,originalAsset:{id:'asset'}},{...n,revisions:[{...n.revisions[0],body:n.revisions[0].body+'\nUser change'}]},{...n,revisions:[{...n.revisions[0],path:'Notes/README.md'}]},{...n,revisions:[n.revisions[0],{...n.revisions[0],version:2}]}];for(const c of cases){const before=structuredClone(c);assert.deepEqual(builtinToolUpdates([c],builtinToolNotes),[]);assert.deepEqual(c,before);}assert.deepEqual(builtinToolUpdates([n],[]),[]);});
test('new defaults describe current local review/execution while external definitions cannot grant connections',()=>{const readme=builtinToolNotes.find(n=>n.id==='builtin-tools-README').body;assert.doesNotMatch(readme,/tool execution is not connected/);assert.match(readme,/local adapters/i);assert.match(readme,/do not execute|do not connect/i);assert.match(builtinToolNotes.find(n=>n.id==='builtin-tools-memory.patch').body,/rewrite/i);assert.match(builtinToolNotes.find(n=>n.id==='builtin-tools-mcp.example').body,/enabled: false/);});

test('bundled tool documentation names reviewed system operations without granting arbitrary writes',()=>{
 const body=builtinToolNotes.find(n=>n.id==='builtin-tools-memory.patch').body;
 assert.match(body,/schedule.patch/);assert.match(body,/settings.patch/);assert.match(body,/enabled.*timezone/);assert.match(body,/Tools.*unavailable/);
});

test('explicit capture documentation promises add-only Inbox writes while answer copies remain reviewed',()=>{
 const capture=builtinToolNotes.find(n=>n.id==='builtin-tools-memory.capture').body,readme=builtinToolNotes.find(n=>n.id==='builtin-tools-README').body;
 assert.match(capture,/operation: create/);assert.match(capture,/Never overwrite an existing record/);assert.match(capture,/separate user-reviewed action/);
 assert.match(readme,/Explicit capture creates a new Inbox file/);assert.match(readme,/Saving an existing assistant answer is a separate reviewed copy/);
});

test('current reviewed Memory settings and user tool packages are described with their actual limits',()=>{
 const readme=builtinToolNotes.find(n=>n.id==='builtin-tools-README').body,body=builtinToolNotes.find(n=>n.id==='builtin-tools-memory.patch').body;
 assert.match(body,/customSets/);assert.match(body,/registered model/i);assert.match(body,/Tool packages/);
 assert.match(body,/diagnosticLogs/);assert.match(body,/never changes downloads, network mode/i);
 assert.match(readme,/Tools\/user\.<id>/i);assert.match(readme,/QuickJS/i);assert.match(readme,/explicitly enabled in a profile/i);assert.match(readme,/network.*write/i);
 assert.match(readme,/sanitized local diagnostic logging/i);assert.match(readme,/remain user-controlled/i);
});

test('exact previous current tool documentation upgrades by appending one revision',()=>{
 for(const id of ['builtin-tools-README','builtin-tools-memory.capture','builtin-tools-memory.patch']){
  const seed=builtinToolNotes.find(n=>n.id===id),oldBody=knownToolBodies[id].at(-1),n=createNote({path:seed.path,body:oldBody});
  const record={...n,id,ui:{protected:true,managed:false}},[updated]=builtinToolUpdates([record],builtinToolNotes);
  assert.ok(updated,`${id} should be recognized`);assert.equal(updated.revisions.at(-1).body,seed.body);assert.equal(updated.revisions.length,2);
 }
});

test('known preceding app documentation upgrades fresh and migrated records without rewriting history',()=>{
 const n=legacy(),body=previousToolBodies.README;
 for(const revisions of [[{...n.revisions[0],body}],[n.revisions[0],{...n.revisions[0],version:2,body}]]){
  const old={...n,revisions},before=structuredClone(old),[updated]=builtinToolUpdates([old],builtinToolNotes);
  assert.ok(updated);assert.deepEqual(old,before);assert.deepEqual(updated.revisions.slice(0,-1),before.revisions);
  assert.equal(updated.revisions.at(-1).version,revisions.length+1);assert.deepEqual(builtinToolUpdates([updated],builtinToolNotes),[]);
 }
 const changed={...n,revisions:[n.revisions[0],{...n.revisions[0],version:2,body:body+' user'}]};
 assert.deepEqual(builtinToolUpdates([changed],builtinToolNotes),[]);
 const reversed={...n,revisions:[{...n.revisions[0],body},{...n.revisions[0],version:2}]};assert.deepEqual(builtinToolUpdates([reversed],builtinToolNotes),[]);
});
