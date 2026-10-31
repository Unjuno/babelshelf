import test from 'node:test';
import assert from 'node:assert/strict';
import {readAppNetworkAccess} from '../dist/connection-policy.js';

function database(read){
 let closed=0,upgrades=0;
 const indexedDB={open(name,version){assert.equal(name,'mlb-memory-v1');assert.equal(version,1);const request={};queueMicrotask(()=>{
  const tx={objectStore(store){assert.equal(store,'notes');return {get(key){assert.equal(key,'settings-connection');const result={};queueMicrotask(()=>{try{result.result=read();result.onsuccess();tx.oncomplete();}catch{tx.onerror();}});return result;}};},abort(){upgrades++;}};
  request.result={objectStoreNames:{contains:()=>true},transaction:(store,mode)=>{assert.equal(store,'notes');assert.equal(mode,'readonly');return tx;},close(){closed++;}};
  request.onsuccess();
 });return request;}};
 return {indexedDB,closed:()=>closed,upgrades:()=>upgrades};
}
const note=downloads=>({id:'settings-connection',state:'active',ui:{managed:true},revisions:[{version:1,path:'Settings/connection.md',body:'# Connection\n\n```json\n'+JSON.stringify({downloads,diagnosticLogs:false})+'\n```\n'}]});

test('network authority is read from the current canonical record on every call, including worker restart',async()=>{
 let current=note(true);const db=database(()=>current);
 assert.equal(await readAppNetworkAccess(db.indexedDB),true);
 current=note(false);assert.equal(await readAppNetworkAccess(db.indexedDB),false);
 const restarted=database(()=>current);assert.equal(await readAppNetworkAccess(restarted.indexedDB),false);
 assert.equal(db.closed(),2);assert.equal(restarted.closed(),1);assert.equal(db.upgrades(),0);
});

test('current versioned connection records and legacy records share the same fail-closed network authority',async()=>{
 const {formatPreference}=await import('../design/prototype/src/preference-records.ts');
 const current=note(true);current.revisions[0].body=formatPreference('connection',{downloads:true,diagnosticLogs:false});
 assert.equal(await readAppNetworkAccess(database(()=>current).indexedDB),true);
 current.revisions[0].body=formatPreference('connection',{downloads:false,diagnosticLogs:false});
 assert.equal(await readAppNetworkAccess(database(()=>current).indexedDB),false);
 for(const schemaVersion of [0,3,'1',null]){
  current.revisions[0].body='# Connection\n\n```json\n'+JSON.stringify({schemaVersion,downloads:true,diagnosticLogs:false})+'\n```\n';
  assert.equal(await readAppNetworkAccess(database(()=>current).indexedDB),false);
 }
 assert.equal(await readAppNetworkAccess(database(()=>note(true)).indexedDB),true);
});

test('missing, withdrawn, malformed or forged settings and unavailable storage fail closed',async()=>{
 for(const current of [undefined,note(false),{...note(true),state:'withdrawn'},{...note(true),id:'other'},{...note(true),ui:{}},{...note(true),revisions:[{path:'Notes/connection.md',body:note(true).revisions[0].body}]},{...note(true),revisions:[{path:'Settings/connection.md',body:'true'}]}])assert.equal(await readAppNetworkAccess(database(()=>current).indexedDB),false);
 assert.equal(await readAppNetworkAccess(undefined),false);
 assert.equal(await readAppNetworkAccess({open(){throw Error('Unavailable');}}),false);
 assert.equal(await readAppNetworkAccess(database(()=>{throw Error('Read failed');}).indexedDB),false);
});

test('a missing database aborts creation and a blocked open times out closed',async()=>{
 let aborted=0;
 const missing={open(){const request={transaction:{abort(){aborted++;}}};queueMicrotask(()=>request.onupgradeneeded());return request;}};
 assert.equal(await readAppNetworkAccess(missing,100),false);assert.equal(aborted,1);
 assert.equal(await readAppNetworkAccess({open(){return {}; }},5),false);
});
