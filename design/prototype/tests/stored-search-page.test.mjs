import test from 'node:test';
import assert from 'node:assert/strict';
import {createNote,reviseNote} from '../../../dist/core.js';
import * as discovery from '../src/file-discovery.ts';
import {run as searchTool} from '../src/tools/memory.search/tool.ts';
import {projectAgentToolResult,agentEvidenceFromCalls} from '../src/agent-evidence.ts';
const {searchStoredPage}=discovery;

test('merged discovery pages preserve file and original passage results without omissions',()=>{
 const notes=Array.from({length:25},(_,i)=>createNote({title:`water ${i}`,body:i%2?`water text ${i}`:'',path:`Inbox/water-${i}.md`}));
 const pages=[0,12,24].map(offset=>searchStoredPage(notes,'water',{offset,limit:12}));
 assert.deepEqual(pages.map(page=>page.hasMore),[true,true,false]);
 const hits=pages.flatMap(page=>page.hits);
 assert.equal(hits.length,25);assert.equal(new Set(hits.map(hit=>hit.noteId)).size,25);
 assert.ok(hits.some(hit=>hit.kind==='file'));assert.ok(hits.some(hit=>typeof hit.quote==='string'));
 for(const hit of hits.filter(hit=>typeof hit.quote==='string')){const note=notes.find(note=>note.id===hit.noteId);assert.equal(note.revisions.at(-1).body.slice(hit.start,hit.end),hit.quote);}
 assert.deepEqual(searchStoredPage(notes,'water',{offset:12,limit:12}),pages[1]);
});

test('paged search uses the host page contract and legacy search remains unchanged',async()=>{
 const notes=Array.from({length:15},(_,i)=>createNote({title:`water ${i}`,body:`water ${i}`,path:`Inbox/water-${i}.md`}));
 const host={check(){},search:async()=>['legacy'],searchPage:async(query,options)=>discovery.searchStoredPageChecked(notes,query,options)};
 assert.deepEqual(await searchTool({query:'water'},host),['legacy']);
 const first=await searchTool({query:'water',offset:0},host);
 assert.equal(first.hits.length,12);assert.equal(first.nextOffset,12);
 const second=await searchTool({query:'water',offset:first.nextOffset,snapshot:first.snapshot},host);
 assert.equal(second.hits.length,3);assert.equal(second.nextOffset,null);
 const shown=projectAgentToolResult('memory.search',second);
 assert.equal(shown.offset,12);assert.equal(shown.nextOffset,null);
 const refs=agentEvidenceFromCalls([{tool:'memory.search',arguments:{query:'water',offset:12,snapshot:first.snapshot},result:shown}]);
 assert.equal(refs.length,3);for(const ref of refs){const note=notes.find(note=>note.id===ref.noteId);assert.equal(note.revisions.at(-1).body.slice(ref.start,ref.end),ref.quote);}
 await assert.rejects(searchTool({query:'water',offset:12},host),/snapshot/i);
});

test('continuation rejects a changed corpus or query while preserving the original page snapshot',()=>{
 const notes=Array.from({length:15},(_,i)=>createNote({title:`water ${i}`,body:`water ${i}`,path:`Inbox/water-${i}.md`}));
 const first=discovery.searchStoredPageChecked(notes,'water',{limit:12});
 assert.equal(first.nextOffset,12);
 const second=discovery.searchStoredPageChecked(notes,'water',{offset:first.nextOffset,limit:12,snapshot:first.snapshot});
 assert.equal(second.hits.length,3);assert.equal(second.nextOffset,null);
 const changed=[...notes];changed[0]=reviseNote(notes[0],{body:'water changed'},1);
 assert.throws(()=>discovery.searchStoredPageChecked(changed,'water',{offset:12,snapshot:first.snapshot}),/changed/i);
 assert.throws(()=>discovery.searchStoredPageChecked(notes,'different',{offset:12,snapshot:first.snapshot}),/changed/i);
 assert.throws(()=>discovery.searchStoredPageChecked(notes,'water',{offset:12}),/snapshot/i);
 assert.equal(notes[0].revisions.length,1);
});
