import test from 'node:test';
import assert from 'node:assert/strict';
import {createInferenceLeaseManager} from '../src/inference-lease.ts';

function locksFixture(){
 let owner=null,requests=0;
 return {get requests(){return requests;},async request(name,options,callback){
  requests++;assert.equal(name,'babelshelf-local-inference');assert.deepEqual(options,{mode:'exclusive',ifAvailable:true});
  if(owner)return callback(null);
  const lock={};owner=lock;
  try{return await callback(lock);}finally{if(owner===lock)owner=null;}
 }};
}

test('same-tab inference leases allow same-role references but refuse overlapping roles',async()=>{
 const locks=locksFixture(),tab=createInferenceLeaseManager(locks),otherTab=createInferenceLeaseManager(locks);
 const text=await tab.acquire('Text');const textReference=await tab.acquire('Text');
 await assert.rejects(tab.acquire('Decision'),/another local inference role is active/i);
 await assert.rejects(otherTab.acquire('Text'),/already active/i);
 await text.release();await assert.rejects(otherTab.acquire('Text'),/already active/i);
 await textReference.release();
 const decision=await tab.acquire('Decision');
 await assert.rejects(tab.acquire('Speech'),/another local inference role is active/i);
 await assert.rejects(otherTab.acquire('Vision'),/already active/i);
 await decision.release();
 const next=await otherTab.acquire('Text');assert.equal(next.protected,true);await next.release();
 assert.equal(locks.requests,6);
});

test('a browser lock request failure clears its reservation so a later attempt can retry',async()=>{
 let calls=0,held=false;const locks={async request(_name,_options,callback){calls++;if(calls===1)throw Error('Lock service failed');if(held)return callback(null);held=true;try{return await callback({});}finally{held=false;}}};
 const manager=createInferenceLeaseManager(locks);await assert.rejects(manager.acquire('Text'),/Lock service failed/);
 const retry=await manager.acquire('Text');assert.equal(retry.protected,true);await retry.release();assert.equal(calls,2);
});

test('a missing Web Locks API preserves local inference availability',async()=>{
 const lease=await createInferenceLeaseManager(null).acquire('Text');
 assert.equal(lease.protected,false);await lease.release();
});
