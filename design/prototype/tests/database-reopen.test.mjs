import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeStore} from '../src/knowledge-store.ts';
import {isDBClosed} from '../../../dist/storage.js';
import {makePendingNoteReview,PENDING_NOTE_REVIEW_STATE} from '../src/pending-note-review.ts';

test('KnowledgeStore reopens a version-changed IndexedDB connection and retains committed data',async()=>{
 const name='database-reopen-'+crypto.randomUUID(),store=new KnowledgeStore(name);
 try{
  await store.initialize([{id:'retained',path:'Inbox/retained.md',body:'saved before versionchange',version:1,history:[]}]);
  const previous=await store.open();
  previous.onversionchange?.(new Event('versionchange'));
  assert.equal(isDBClosed(previous),true);
  const reopened=await store.open();
  assert.notEqual(reopened,previous);
  assert.equal((await store.viewById('retained'))?.body,'saved before versionchange');
  const before=await store.views();
  await store.commit(before,[{...before[0],body:'saved after reconnect',version:2,history:[before[0].body]}]);
  assert.equal((await store.viewById('retained'))?.body,'saved after reconnect');
 }finally{
  store.close();
  await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=resolve;request.onerror=()=>reject(request.error);});
 }
});

test('UI commit retries once when a connection closes at transaction start',async()=>{
 const name='database-reopen-commit-'+crypto.randomUUID(),store=new KnowledgeStore(name);let previous;
 try{
  await store.initialize([{id:'retained',path:'Inbox/retained.md',body:'before',version:1,history:[]}]);
  const before=await store.views();previous=await store.open();let closeOnce=true;
  store.database=new Proxy(previous,{get(target,key){if(key==='transaction')return(...args)=>{if(closeOnce){closeOnce=false;throw new DOMException('The database connection is closing','InvalidStateError');}return target.transaction(...args);};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
  await store.commit(before,[{...before[0],body:'after',version:2,history:['before']}]);
  assert.equal((await store.viewById('retained'))?.body,'after');
 }finally{
  previous?.close();
  store.close();
  await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=resolve;request.onerror=()=>reject(request.error);});
 }
});

async function isolatedStore(t){
 const name='database-reopen-boundary-'+crypto.randomUUID(),store=new KnowledgeStore(name),connections=[];
 t.after(async()=>{store.close();for(const connection of connections)connection.close();await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=resolve;request.onerror=()=>reject(request.error);});});
 await store.initialize([]);
 return {store,connections};
}

async function interceptTransactionStart(store,connections,intercept){
 const previous=await store.open(),open=store.open.bind(store);connections.push(previous);let opens=0;
 store.database=new Proxy(previous,{get(target,key){
  if(key==='transaction')return(...args)=>intercept(()=>target.transaction(...args));
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});
 store.open=async()=>{opens++;return open();};
 return {get opens(){return opens;}};
}

async function closeAtNextTransaction(store,connections){
 let first=true;
 return interceptTransactionStart(store,connections,start=>{if(first){first=false;throw new DOMException('The database connection is closing','InvalidStateError');}return start();});
}

test('folder creation recovers a closing connection and commits its namespace once',async t=>{
 const {store,connections}=await isolatedStore(t),boundary=await closeAtNextTransaction(store,connections);
 const result=await store.createFolder('Inbox/recovered',undefined);
 assert.equal(boundary.opens,2);assert.deepEqual(result,{path:'Inbox/recovered',folders:['Inbox/recovered']});
 assert.deepEqual(await store.getState('folders'),['Inbox/recovered']);
});

test('reviewed note Save recovers before writing and atomically consumes the exact pending draft',async t=>{
 const {store,connections}=await isolatedStore(t);
 const pending=await store.stageNoteReview(makePendingNoteReview({id:'reviewed',path:'Inbox/reviewed.md',body:'Exact 日本語\r\nreviewed draft',kind:'generated',sources:[]},'turn','2026-11-12T00:00:00.000Z'));
 const boundary=await closeAtNextTransaction(store,connections),saved=await store.saveReviewedNote(pending,pending);
 assert.equal(boundary.opens,2);assert.equal(saved.id,pending.note.id);assert.equal(saved.body,pending.note.body);
 assert.equal(await store.getState(PENDING_NOTE_REVIEW_STATE),undefined);assert.equal((await store.all()).length,1);
});

test('auxiliary CAS recovers a closing connection without dropping the expected value',async t=>{
 const {store,connections}=await isolatedStore(t);await store.setState('audit-cas',{revision:1,body:'before'});
 const boundary=await closeAtNextTransaction(store,connections);
 await store.compareState('audit-cas',{revision:1,body:'before'},{revision:2,body:'after'});
 assert.equal(boundary.opens,2);assert.deepEqual(await store.getState('audit-cas'),{revision:2,body:'after'});
});

test('reconnecting does not turn a stale auxiliary CAS into an authorized overwrite',async t=>{
 const {store,connections}=await isolatedStore(t);await store.setState('audit-cas',{revision:2,body:'another tab'});
 const boundary=await closeAtNextTransaction(store,connections);
 await assert.rejects(store.compareState('audit-cas',{revision:1,body:'before'},{revision:3,body:'stale draft'}),/Local data changed in another tab/);
 assert.equal(boundary.opens,2);assert.deepEqual(await store.getState('audit-cas'),{revision:2,body:'another tab'});
});

test('readonly processing history can recover a closing transaction start',async t=>{
 const {store,connections}=await isolatedStore(t),boundary=await closeAtNextTransaction(store,connections);
 assert.deepEqual(await store.processingHistory(),[]);assert.equal(boundary.opens,2);
});

test('a non-closing transaction-start error is preserved without retrying folder creation',async t=>{
 const {store,connections}=await isolatedStore(t),failure=new DOMException('Access denied','SecurityError');
 const boundary=await interceptTransactionStart(store,connections,()=>{throw failure;});
 await assert.rejects(store.createFolder('Inbox/blocked',undefined),error=>error===failure);
 assert.equal(boundary.opens,1);
});

test('an aborted transaction after a write starts is not replayed through reconnection',async t=>{
 const {store,connections}=await isolatedStore(t);await store.setState('audit-cas','before');let writes=0;
 const boundary=await interceptTransactionStart(store,connections,start=>{
  const tx=start(),objectStore=tx.objectStore.bind(tx);
  tx.objectStore=name=>{const target=objectStore(name);return new Proxy(target,{get(target,key){
   if(key==='put')return(...args)=>{writes++;const request=target.put(...args);request.addEventListener('success',()=>tx.abort(),{once:true});return request;};
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});};return tx;
 });
 await assert.rejects(store.compareState('audit-cas','before','uncommitted'),/Conversation save failed/);
 assert.equal(boundary.opens,1);assert.equal(writes,1);assert.equal(await store.getState('audit-cas'),'before');
});
