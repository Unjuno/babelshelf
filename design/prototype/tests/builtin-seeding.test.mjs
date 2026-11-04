import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {builtinToolNotes} from '../src/tool-definitions.ts';
import {KnowledgeStore} from '../src/knowledge-store.ts';

const removeDatabase=name=>new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=resolve;request.onerror=()=>reject(request.error);});

test('initialization seeds current defaults once and preserves every saved note',async()=>{
 const name='builtin-seed-'+crypto.randomUUID(),store=new KnowledgeStore(name);
 const user={id:'user-note',path:'Notes/keep.md',body:'Original user bytes · 日本語',version:1,history:[]};
 const custom={...builtinToolNotes[0],body:builtinToolNotes[0].body+'\nUser customization.'};
 try{
  await store.initialize([custom,user]);const before=await store.all();
  await store.initialize(builtinToolNotes);const seeded=await store.all();
  assert.equal(seeded.length,builtinToolNotes.length+1);
  assert.deepEqual(seeded.find(note=>note.id===custom.id),before.find(note=>note.id===custom.id));
  assert.deepEqual(seeded.find(note=>note.id===user.id),before.find(note=>note.id===user.id));
  for(const seed of builtinToolNotes)if(seed.id!==custom.id)assert.equal(seeded.find(note=>note.id===seed.id).revisions[0].body,seed.body);
  await store.initialize(builtinToolNotes.map(seed=>({...seed,body:seed.body+' newer app default'})));
  assert.deepEqual(await store.all(),seeded);
 }finally{store.close();await removeDatabase(name);}
});

test('concurrent initialization seeds each current definition only once',async()=>{
 const name='builtin-seed-concurrent-'+crypto.randomUUID(),first=new KnowledgeStore(name),second=new KnowledgeStore(name);
 try{
  await Promise.all([first.initialize(builtinToolNotes),second.initialize(builtinToolNotes)]);
  const records=await first.all();assert.equal(records.length,builtinToolNotes.length);
  for(const seed of builtinToolNotes){const record=records.find(note=>note.id===seed.id);assert.equal(record.revisions.length,1);assert.equal(record.revisions[0].body,seed.body);}
 }finally{first.close();second.close();await removeDatabase(name);}
});
