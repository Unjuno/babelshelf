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
