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

test('unique discovery keeps the best passage per file in existing ranking order',()=>{
 const notes=[core.createNote({title:'water long',body:'water '.repeat(5000),path:'Inbox/long.md'}),...Array.from({length:24},(_,i)=>core.createNote({title:`water ${i}`,body:`water reserve ${i}`,path:`Inbox/${i}.md`}))];
 const existing=core.searchStoredNotesWindow(notes,'water',100);
 const unique=core.searchStoredNotesUniqueWindow(notes,'water',100);
 const expected=[];for(const hit of existing)if(!expected.some(previous=>previous.noteId===hit.noteId))expected.push(hit);
 assert.deepEqual(unique,expected);assert.equal(unique.length,25);
});
