import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeStore} from '../src/knowledge-store.ts';
import {createNewNoteView} from '../src/note-creation.ts';
import {makeStateBackup,parseStateBackup} from '../src/backup-state.ts';

test('stored search pages reflect IndexedDB and reject continuation after another record is added',async()=>{
 const name='search-page-'+crypto.randomUUID(),store=new KnowledgeStore(name);
 const seeds=Array.from({length:15},(_,i)=>({id:`water-${i}`,path:`Inbox/water-${i}.md`,body:`water reserve ${i}`,version:1,history:[]}));
 try{
  await store.initialize(seeds);
  const first=await store.searchPage('water',{offset:0,limit:12});
  const second=await store.searchPage('water',{offset:first.nextOffset,limit:12,snapshot:first.snapshot});
  assert.equal(first.hits.length,12);assert.equal(second.hits.length,3);assert.equal(second.hasMore,false);
  const before=await store.all();
  await store.initialize([...seeds,{id:'water-new',path:'Inbox/water-new.md',body:'water new',version:1,history:[]}]);
  await assert.rejects(store.searchPage('water',{offset:first.nextOffset,limit:12,snapshot:first.snapshot}),/changed/i);
  const after=await store.all();for(const note of before)assert.deepEqual(after.find(item=>item.id===note.id),note);
 }finally{store.close();await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=resolve;request.onerror=()=>reject(request.error);});}
});

test('approved new note keeps its second-page original through local backup',async()=>{
 const name='search-save-'+crypto.randomUUID(),restoreName='search-restore-'+crypto.randomUUID(),store=new KnowledgeStore(name),destination=new KnowledgeStore(restoreName),seeds=Array.from({length:15},(_,i)=>({id:`water-${i}`,path:`Inbox/water-${i}.md`,body:`water reserve ${i}`,version:1,history:[]}));
 try{
  await store.initialize(seeds);const originals=await store.all(),first=await store.searchPage('water',{offset:0,limit:12}),second=await store.searchPage('water',{offset:12,limit:12,snapshot:first.snapshot}),hit=second.hits[0];
  assert.equal(typeof hit.quote,'string');const ref={noteId:hit.noteId,revision:hit.revision,start:hit.start,end:hit.end,quote:hit.quote};
  const before=await store.views(),note=createNewNoteView({id:'reviewed-answer',path:'Inbox/reviewed-answer.md',body:hit.quote,kind:'generated',sources:[ref]});
  await store.commit(before,[...before,note]);const saved=await store.all(),created=saved.find(item=>item.id===note.id);
  assert.equal(created.revisions[0].body,hit.quote);assert.deepEqual(created.sources,[ref]);for(const original of originals)assert.deepEqual(saved.find(item=>item.id===original.id),original);
  const backup=JSON.stringify(await makeStateBackup({notes:saved,settings:[],runs:[]})),restored=await parseStateBackup(backup);
  assert.deepEqual(restored.notes.find(item=>item.id===note.id).sources,[ref]);const source=restored.notes.find(item=>item.id===ref.noteId);assert.equal(source.revisions[ref.revision-1].body.slice(ref.start,ref.end),ref.quote);
  await destination.restore(backup);const imported=await destination.all();assert.deepEqual(imported.find(item=>item.id===note.id).sources,[ref]);assert.equal(imported.find(item=>item.id===ref.noteId).revisions[0].body.slice(ref.start,ref.end),ref.quote);
  const views=await destination.views(),target=views.find(item=>item.id===ref.noteId),changed={...target,body:target.body+' updated',version:target.version+1,history:[...target.history,target.body]};
  await destination.commit(views,views.map(item=>item.id===target.id?changed:item));const beforeConflict=await destination.all();
  const conflict=await destination.restore(backup);assert.equal(conflict.restored,false);assert.ok(conflict.conflicts.some(item=>item.key===ref.noteId));assert.deepEqual(await destination.all(),beforeConflict);
 }finally{store.close();destination.close();for(const dbName of [name,restoreName])await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(dbName);request.onsuccess=resolve;request.onerror=()=>reject(request.error);});}
});
