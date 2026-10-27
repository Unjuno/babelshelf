import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverStartup,startupGate,invalidStoredPaths,recoveryTextRecord,inspectStoredPaths} from '../product/startup-recovery.ts';
import {makeRecoverySnapshot,parseStateBackup} from '../src/backup-state.ts';

test('unverified recovery snapshot retains invalid data and is not accepted as a normal backup',async()=>{const snapshot={notes:[{id:'n',revisions:[{path:'bad?.md',body:'original',optional:undefined}]}],settings:[],runs:[{key:'original',value:{data:'aGVsbG8='}}]},pack=makeRecoverySnapshot(snapshot);assert.equal(pack.payload.notes[0].revisions[0].body,'original');assert.equal(pack.payload.runs[0].value.data,'aGVsbG8=');assert.deepEqual(pack.payload.undefinedPaths,[['notes','0','revisions','0','optional']]);await assert.rejects(parseStateBackup(JSON.stringify(pack)),/verification/i);assert.throws(()=>makeRecoverySnapshot({...snapshot,runs:[{key:'x',value:new Date()}]}),/unsupported/i);});

test('path inspection identifies historical bad paths without changing records',()=>{
 const records=[{id:'note-1',revisions:[{version:1,title:'x',path:'Inbox/bad?.md'},{version:2,title:'x',path:'Inbox/good.md'}]}],before=structuredClone(records);
 assert.deepEqual(invalidStoredPaths(records),[{id:'note-1',version:1,path:'Inbox/bad?.md',hasOriginal:false}]);assert.deepEqual(records,before);
});
test('recovery text export keeps all revision text and rejects incomplete records',()=>{const note={id:'n',revisions:[{version:1,title:'x',body:'原文',at:'t',path:'bad?.md'},{version:2,title:'x',body:'訂正',at:'u'}]};assert.deepEqual(recoveryTextRecord(note).revisions,note.revisions);assert.throws(()=>recoveryTextRecord({id:'n',revisions:[{version:1}]}),/Text unavailable/);});
test('a blocked recovery open closes a connection that succeeds later',async()=>{const previous=globalThis.indexedDB;let closed=0;const request={result:{close(){closed++;}}};globalThis.indexedDB={open:()=>request};try{const pending=inspectStoredPaths();request.onblocked();await assert.rejects(pending,/Storage unavailable/);request.onsuccess();assert.equal(closed,1);}finally{if(previous===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=previous;}});

test('initialization failures offer explicit recovery, while ordinary loading does not',()=>{
 assert.deepEqual(startupGate('', '', ''),{message:'Opening local storage…',recoverable:false});
 assert.deepEqual(startupGate('Invalid Markdown path', '', ''),{message:'Invalid Markdown path',recoverable:true});
 assert.deepEqual(startupGate('', 'Metadata unavailable', ''),{message:'Metadata unavailable',recoverable:true});
 assert.deepEqual(startupGate('', '', 'Dialogue unavailable'),{message:'Dialogue unavailable',recoverable:true});
});

test('startup recovery updates only on an explicit invocation and reloads after success',async()=>{
 let registrations=0,updates=0,reloads=0;
 await recoverStartup({getRegistration:async()=>{registrations++;return {};},update:async()=>{updates++;},reload:()=>{reloads++;}});
 assert.deepEqual([registrations,updates,reloads],[1,1,1]);
});
test('missing registration or failed update never reloads',async()=>{
 let reloads=0;
 await assert.rejects(recoverStartup({getRegistration:async()=>undefined,update:async()=>{},reload:()=>{reloads++;}}),/unavailable/i);
 await assert.rejects(recoverStartup({getRegistration:async()=>({}),update:async()=>{throw Error('offline');},reload:()=>{reloads++;}}),/offline/i);
 assert.equal(reloads,0);
});
