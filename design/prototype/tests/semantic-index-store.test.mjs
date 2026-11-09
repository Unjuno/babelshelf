import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSemanticIndexStore} from '../src/semantic-index-store.ts';

const make=(modelRevision,noteId,revision,start,vector)=>({modelRevision,noteId,revision,start,end:start+5,quote:'Fact.',vector});
async function removeDatabase(name){await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=resolve;request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Database deletion blocked'));});}

test('semantic derived index replaces one note revision without touching other model or source entries',async()=>{
 const name='semantic-index-test-'+crypto.randomUUID(),store=createSemanticIndexStore({name});
 try{
  await store.replaceNote('embed-r1','note-a',1,[make('embed-r1','note-a',1,0,[1,0]),make('embed-r1','note-a',1,10,[0,1])]);
  await store.replaceNote('embed-r1','note-b',1,[make('embed-r1','note-b',1,0,[1,1])]);
  await store.replaceNote('embed-r2','note-a',1,[make('embed-r2','note-a',1,0,[2,0])]);
  await store.replaceNote('embed-r1','note-a',2,[make('embed-r1','note-a',2,20,[1,1])]);
  const first=await store.list('embed-r1');assert.deepEqual(first.map(value=>[value.noteId,value.revision,value.start]).sort(),[['note-a',2,20],['note-b',1,0]]);
  const typed=await store.list('embed-r2');assert.equal(typed[0].modelRevision,'embed-r2');assert.ok(typed[0].vector instanceof Float32Array);
  await store.replaceNote('embed-r1','note-b',2,[]);
  assert.deepEqual((await store.list('embed-r1')).map(value=>value.noteId),['note-a']);
 }finally{await store.close();await removeDatabase(name);}
});

test('semantic derived index rejects mismatched source identity and malformed vectors without partial replacement',async()=>{
 const name='semantic-index-invalid-'+crypto.randomUUID(),store=createSemanticIndexStore({name});
 try{
  await store.replaceNote('embed-r1','note-a',1,[make('embed-r1','note-a',1,0,[1,0])]);
  await assert.rejects(store.replaceNote('embed-r1','note-a',2,[make('embed-r1','note-a',1,0,[0,1])]),/Invalid semantic index record/);
  await assert.rejects(store.replaceNote('embed-r1','note-a',2,[make('embed-r1','note-a',2,0,[Infinity,0])]),/Invalid semantic index record/);
  assert.deepEqual((await store.list('embed-r1')).map(value=>[value.revision,value.start]),[[1,0]]);
 }finally{await store.close();await removeDatabase(name);}
});

test('semantic indexing cancellation and model removal leave canonical Memory separate',async()=>{
 const name='semantic-index-isolation-'+crypto.randomUUID(),store=createSemanticIndexStore({name}),memory='mlb-memory-isolation-'+crypto.randomUUID();
 const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(memory,1);request.onupgradeneeded=()=>request.result.createObjectStore('notes',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{
  const tx=db.transaction('notes','readwrite');tx.objectStore('notes').put({id:'original',body:'Keep this source'});await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
  const controller=new AbortController();controller.abort();await assert.rejects(store.replaceNote('embed-r1','original',1,[make('embed-r1','original',1,0,[1])],controller.signal),/Stopped/);
  await store.replaceNote('embed-r1','original',1,[make('embed-r1','original',1,0,[1])]);
  const read=db.transaction('notes','readonly').objectStore('notes').get('original');const original=await new Promise((resolve,reject)=>{read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(read.error);});
  assert.deepEqual(original,{id:'original',body:'Keep this source'});
  await store.removeModel('embed-r1');assert.deepEqual(await store.list('embed-r1'),[]);
 }finally{db.close();await store.close();await removeDatabase(name);await removeDatabase(memory);}
});
