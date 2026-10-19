import test from 'node:test';
import assert from 'node:assert/strict';
import {VisionClient} from '../src/vision-control.ts';

test('vision client serializes requests and resolves only the active response',async()=>{
 const workers=[],states=[],client=new VisionClient(()=>{const worker={postMessage(message){worker.last=message;},terminate(){worker.terminated=true;}};workers.push(worker);return worker;},(busy,progress)=>states.push({busy,progress}));
 const pending=client.call('prepare',{allowNetwork:false});assert.deepEqual(workers[0].last,{id:1,type:'prepare',allowNetwork:false});await assert.rejects(client.call('describe'),/busy/i);
 workers[0].onmessage({data:{id:1,progress:'Checking'}});assert.deepEqual(states.at(-1),{busy:true,progress:'Checking'});
 workers[0].onmessage({data:{id:1,value:{text:'A red cup.'}}});assert.deepEqual(await pending,{text:'A red cup.'});assert.deepEqual(states.at(-1),{busy:false,progress:undefined});
});

test('stopping a vision request terminates its worker and rejects late replies',async()=>{
 let worker,updates=0;const client=new VisionClient(()=>worker={postMessage(){},terminate(){worker.terminated=true;}},()=>updates++),pending=client.call('describe',{prompt:'Describe'});pending.catch(()=>{});
 client.stop();assert.equal(worker.terminated,true);await assert.rejects(pending,/Stopped/);
 worker.onmessage?.({data:{id:1,value:{text:'late'}}});assert.equal(updates,2);
});
