import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSemanticIndexStore} from '../src/semantic-index-store.ts';
import {indexSemanticSources,searchSemanticSources} from '../src/semantic-search-service.ts';

const vector=text=>text.includes('seed')||text.includes('芽')?[1,0]:[0,1];
const embed=async texts=>texts.map(vector);
const source=(overrides={})=>({id:'note-a',state:'active',revision:1,title:'Garden',path:'Notes/garden.md',body:'A seed needs light. 🌱 A seed needs water.',...overrides});
async function removeDatabase(name){await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=resolve;request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Database deletion blocked'));});}

test('indexing and retrieval preserve exact current quotes and leave canonical sources untouched',async()=>{
 const name='semantic-service-'+crypto.randomUUID(),store=createSemanticIndexStore({name}),events=[];try{
  const canonical=source();const indexed=await indexSemanticSources([canonical],{modelRevision:'embed-r1',store,embed,batchSize:1,progress:(done,total)=>events.push([done,total])});
  assert.equal(indexed.chunks,1);assert.deepEqual(events,[[0,1],[1,1]]);
  const stored=await store.list('embed-r1');assert.equal(Object.hasOwn(stored[0],'quote'),false);assert.equal(stored[0].end-stored[0].start,canonical.body.length);
  const hits=await searchSemanticSources('How do I grow a seed?', async()=>[canonical],{modelRevision:'embed-r1',store,embed});
  assert.equal(hits.length,1);assert.equal(hits[0].quote,canonical.body);assert.equal(hits[0].end,canonical.body.length);assert.equal(hits[0].revision,1);
  assert.equal(canonical.body,'A seed needs light. 🌱 A seed needs water.');
 }finally{await store.close();await removeDatabase(name);}
});

test('an empty derived index skips query inference and source reads',async()=>{
 const name='semantic-service-empty-'+crypto.randomUUID(),store=createSemanticIndexStore({name});let embeddingCalls=0,sourceReads=0;try{
  const results=await searchSemanticSources('seed',async()=>{sourceReads++;return [source()];},{modelRevision:'embed-r1',store,embed:async texts=>{embeddingCalls++;return texts.map(vector);}});
  assert.deepEqual(results,[]);assert.equal(embeddingCalls,0);assert.equal(sourceReads,0);
 }finally{await store.close();await removeDatabase(name);}
});

test('failed replacement preserves prior revision vectors and search never returns stale citations',async()=>{
 const name='semantic-service-revision-'+crypto.randomUUID(),store=createSemanticIndexStore({name});try{
  const old=source();await indexSemanticSources([old],{modelRevision:'embed-r1',store,embed});
  const next=source({revision:2,body:'A seed needs careful watering.'});
  await assert.rejects(indexSemanticSources([next],{modelRevision:'embed-r1',store,embed:async()=>{throw Error('embedding failed');}}),/embedding failed/);
  assert.deepEqual((await store.list('embed-r1')).map(item=>item.revision),[1]);
  assert.deepEqual(await searchSemanticSources('seed', async()=>[next],{modelRevision:'embed-r1',store,embed}),[]);
  await indexSemanticSources([next],{modelRevision:'embed-r1',store,embed});
  const hits=await searchSemanticSources('seed', async()=>[next],{modelRevision:'embed-r1',store,embed});assert.equal(hits[0].revision,2);assert.equal(hits[0].quote,next.body);
 }finally{await store.close();await removeDatabase(name);}
});

test('search re-reads current source revisions after embedding before binding citations',async()=>{
 const name='semantic-service-live-'+crypto.randomUUID(),store=createSemanticIndexStore({name});try{
  const old=source();await indexSemanticSources([old],{modelRevision:'embed-r1',store,embed});
  let live=old;const delayedEmbed=async texts=>{const vectors=await embed(texts);live=source({revision:2,body:'A seed now has a changed source.'});return vectors;};
  const results=await searchSemanticSources('seed',async()=>[live],{modelRevision:'embed-r1',store,embed:delayedEmbed});
  assert.deepEqual(results,[]);
 }finally{await store.close();await removeDatabase(name);}
});

test('indexing removes derived entries for withdrawn, protected, system and deleted sources only',async()=>{
 const name='semantic-service-prune-'+crypto.randomUUID(),store=createSemanticIndexStore({name});try{
  const active=source(),withdrawn=source({id:'withdrawn'}),protectedNote=source({id:'protected'}),system=source({id:'system'}),deleted=source({id:'deleted'});
  await indexSemanticSources([active,withdrawn,protectedNote,system,deleted],{modelRevision:'embed-r1',store,embed});
  assert.equal((await store.list('embed-r1')).length,5);
  const next=source({revision:2,body:'The seed is safe.'});
  await indexSemanticSources([next,{...withdrawn,state:'withdrawn'},{...protectedNote,protected:true},{...system,path:'Settings/private.md'}],{modelRevision:'embed-r1',store,embed});
  const indexed=await store.list('embed-r1');assert.deepEqual(indexed.map(item=>[item.noteId,item.revision]),[['note-a',2]]);
  assert.equal(active.body,'A seed needs light. 🌱 A seed needs water.');
 }finally{await store.close();await removeDatabase(name);}
});

test('invalid embeddings and aborted work do not replace prior note vectors',async()=>{
 const name='semantic-service-abort-'+crypto.randomUUID(),store=createSemanticIndexStore({name});try{
  const old=source();await indexSemanticSources([old],{modelRevision:'embed-r1',store,embed});
  const next=source({revision:2,body:'A seed can grow.'});
  await assert.rejects(indexSemanticSources([next],{modelRevision:'embed-r1',store,embed:async()=>[[NaN,0]]}),/Invalid embedding vector/);
  const controller=new AbortController();controller.abort();await assert.rejects(indexSemanticSources([next],{modelRevision:'embed-r1',store,embed,signal:controller.signal}),/Stopped/);
  assert.deepEqual((await store.list('embed-r1')).map(item=>[item.revision,item.start,item.end,'quote' in item]),[[1,0,old.body.length,false]]);
 }finally{await store.close();await removeDatabase(name);}
});

test('semantic indexing checks the work budget before embedding or replacing records',async()=>{
 const name='semantic-service-budget-'+crypto.randomUUID(),store=createSemanticIndexStore({name}),large=source({body:'A seed needs light and water. '.repeat(80)});let calls=0;try{
  await assert.rejects(indexSemanticSources([large],{modelRevision:'embed-r1',store,embed:async texts=>{calls++;return texts.map(vector);},maxChunks:1}),/work limit/);
  assert.equal(calls,0);assert.deepEqual(await store.list('embed-r1'),[]);
 }finally{await store.close();await removeDatabase(name);}
});
