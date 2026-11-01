import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshAppVersion} from '../src/offline-shell.ts';

function fixture(){
 const container=new EventTarget();
 const registration={active:null,waiting:null,installing:null};
 const activated=[];
 const makeWorker=name=>{
  const worker=new EventTarget();worker.state='installed';
  worker.postMessage=message=>{
   assert.deepEqual(message,{type:'activate-update'});activated.push(name);
   registration.waiting=null;registration.active=worker;worker.state='activated';
   container.controller=worker;worker.dispatchEvent(new Event('statechange'));
  };
  return worker;
 };
 registration.waiting=makeWorker('staged');
 return {container,registration,activated,makeWorker};
}
test('refresh checks the server before activating an older staged build',async()=>{
 const {container,registration,activated,makeWorker}=fixture();let checks=0;
 registration.update=async()=>{checks++;registration.waiting=makeWorker('latest');};
 assert.equal(await refreshAppVersion(registration,container,100),'Updated');
 assert.equal(checks,1);assert.deepEqual(activated,['latest']);
 assert.equal(container.controller,registration.active);
});
test('unchanged staged build activates after a successful freshness check',async()=>{
 const {container,registration,activated}=fixture();registration.update=async()=>{};
 assert.equal(await refreshAppVersion(registration,container,100),'Updated');
 assert.deepEqual(activated,['staged']);
});
test('stalled freshness check does not claim or activate a latest build and can be retried',async()=>{
 const {container,registration,activated}=fixture();registration.update=()=>new Promise(()=>{});
 await assert.rejects(refreshAppVersion(registration,container,10),/Update timed out/);
 assert.deepEqual(activated,[]);assert.equal(registration.waiting.state,'installed');
 registration.update=async()=>{};
 assert.equal(await refreshAppVersion(registration,container,100),'Updated');
});
