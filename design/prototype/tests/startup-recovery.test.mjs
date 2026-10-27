import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverStartup,startupGate} from '../product/startup-recovery.ts';

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
