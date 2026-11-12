import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeStore} from '../src/knowledge-store.ts';
import {isDBClosed} from '../../../dist/storage.js';

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
