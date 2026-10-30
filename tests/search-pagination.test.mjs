import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/core.js';

test('stored search can traverse more than twelve distinct documents without losing original ranges',()=>{
 const notes=Array.from({length:25},(_,i)=>core.createNote({title:`Water ${i}`,body:`water reserve ${i}`,path:`Inbox/water-${i}.md`}));
 const first=core.searchStoredNotesPage(notes,'water',{offset:0,limit:12});
 const second=core.searchStoredNotesPage(notes,'water',{offset:12,limit:12});
 const third=core.searchStoredNotesPage(notes,'water',{offset:24,limit:12});
 assert.deepEqual([first.hasMore,second.hasMore,third.hasMore],[true,true,false]);
 const hits=[...first.hits,...second.hits,...third.hits];
 assert.equal(hits.length,25);assert.equal(new Set(hits.map(hit=>hit.noteId)).size,25);
 for(const hit of hits){const note=notes.find(note=>note.id===hit.noteId),revision=note.revisions.find(item=>item.version===hit.revision);assert.equal(revision.body.slice(hit.start,hit.end),hit.quote);}
 assert.deepEqual(core.searchStoredNotesPage(notes,'water',{offset:12,limit:12}),second);
});
