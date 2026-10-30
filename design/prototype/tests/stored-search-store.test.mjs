import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeStore} from '../src/knowledge-store.ts';

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
