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

test('a completed image inference releases its worker before handing observations to the next model',async()=>{
 const workers=[],events=[],client=new VisionClient(()=>{const worker={postMessage(message){worker.last=message;},terminate(){worker.terminated=true;events.push('released');}};workers.push(worker);return worker;},()=>{});
 const first=client.call('describe',{prompt:'What is shown?'}).then(value=>{events.push('delivered');return value;});const old=workers[0];old.onmessage({data:{id:old.last.id,value:{text:'A green card.'}}});
 assert.deepEqual(await first,{text:'A green card.'});assert.equal(old.terminated,true);assert.deepEqual(events,['released','delivered']);
 const next=client.call('describe',{prompt:'Read this image.'});assert.equal(workers.length,2);old.onmessage({data:{id:workers[1].last.id,value:{text:'stale'}}});workers[1].onmessage({data:{id:workers[1].last.id,value:{text:'New observations.'}}});assert.deepEqual(await next,{text:'New observations.'});assert.equal(workers[1].terminated,true);
});

test('a failed image inference releases the worker and only a new explicit request retries',async()=>{
 const workers=[],client=new VisionClient(()=>{const worker={postMessage(message){worker.last=message;},terminate(){worker.terminated=true;}};workers.push(worker);return worker;},()=>{});
 const first=client.call('describe');const refused=assert.rejects(first,/Device unavailable/);workers[0].onmessage({data:{id:workers[0].last.id,error:'Device unavailable'}});await refused;assert.equal(workers[0].terminated,true);assert.equal(workers.length,1);
 const status=client.call('status');assert.equal(workers.length,2);workers[1].onmessage({data:{id:workers[1].last.id,value:{ready:true}}});assert.deepEqual(await status,{ready:true});assert.notEqual(workers[1].terminated,true);
});

test('image inference waits for resident-model release and owns the request while waiting',{timeout:1000},async()=>{
 let release;const workers=[],events=[];const ready=new Promise(resolve=>release=resolve);
 const client=new VisionClient(()=>{const worker={postMessage(m){worker.last=m;events.push('describe');},terminate(){}};workers.push(worker);return worker;},()=>{},async check=>{events.push('release');await ready;check();});
 const result=client.call('describe');assert.deepEqual(events,['release']);assert.equal(workers.length,0);await assert.rejects(client.call('describe'),/busy/);
 release();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(events,['release','describe']);workers[0].onmessage({data:{id:workers[0].last.id,value:{text:'Green'}}});assert.deepEqual(await result,{text:'Green'});
});

test('Stop while releasing another model never starts delayed image inference',{timeout:1000},async()=>{
 let release,created=0;const ready=new Promise(resolve=>release=resolve),client=new VisionClient(()=>{created++;return {postMessage(){},terminate(){}};},()=>{},async check=>{await ready;check();});
 const result=client.call('describe');const stopped=assert.rejects(result,/Stopped/);client.stop();await stopped;release();await Promise.resolve();await Promise.resolve();assert.equal(created,0);
});

test('a release failure refuses image inference without replay and permits a later explicit call',{timeout:1000},async()=>{
 let fail=true,created=0;const client=new VisionClient(()=>{created++;return {postMessage(){},terminate(){}};},()=>{},async()=>{if(fail)throw Error('Unload failed');});
 await assert.rejects(client.call('describe'),/Unload failed/);assert.equal(created,0);fail=false;const next=client.call('describe');next.catch(()=>{});await Promise.resolve();await Promise.resolve();assert.equal(created,1);client.stop();await assert.rejects(next,/Stopped/);
});

test('resident release refuses active inference before unloading either model',async()=>{
 const {releaseIdleInference}=await import('../src/inference-ownership.ts');const released=[];
 await assert.rejects(releaseIdleInference([{loaded:'text',busy:false,unload:async()=>{released.push('text');}},{loaded:true,busy:true,unload:async()=>{released.push('decision');}}],()=>{}),/Model busy/);assert.deepEqual(released,[]);
});

test('resident release waits for idle loaded models and respects cancellation between owners',async()=>{
 const {releaseIdleInference}=await import('../src/inference-ownership.ts');const released=[];let cancelled=false;
 const ports=[{loaded:'text',busy:false,unload:async()=>{released.push('text');cancelled=true;}},{loaded:true,busy:false,unload:async()=>{released.push('decision');}}];
 await assert.rejects(releaseIdleInference(ports,()=>{if(cancelled)throw Error('Stopped');}),/Stopped/);assert.deepEqual(released,['text']);
 cancelled=false;released.length=0;ports[0].unload=async()=>{released.push('text');};await releaseIdleInference([...ports,{loaded:false,busy:false,unload:async()=>{throw Error('Idle empty model must not be loaded');}}],()=>{});assert.deepEqual(released,['text','decision']);
});
