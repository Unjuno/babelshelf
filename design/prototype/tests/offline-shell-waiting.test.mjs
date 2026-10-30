import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshAppVersion} from '../src/offline-shell.ts';

test('an explicit refresh applies an installed waiting update before a stalled network check',async()=>{
 const container=new EventTarget();
 const worker=new EventTarget();
 worker.state='installed';
 let checks=0;
 worker.postMessage=message=>{
  assert.deepEqual(message,{type:'activate-update'});
  worker.state='activated';
  container.controller=worker;
  worker.dispatchEvent(new Event('statechange'));
 };
 const registration={waiting:worker,update(){checks++;return new Promise(()=>{});}};
 assert.equal(await refreshAppVersion(registration,container,30),'Updated');
 assert.equal(checks,0);
});
