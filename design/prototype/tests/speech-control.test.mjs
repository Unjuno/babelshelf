import test from 'node:test';import assert from 'node:assert/strict';
import {SpeechClient,MicrophoneGate,saveReviewedTranscript} from '../src/speech-control.ts';
class WorkerFixture{onmessage=null;onerror=null;terminated=false;messages=[];postMessage(v){this.messages.push(v);}terminate(){this.terminated=true;}}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('failed speech worker is discarded; retry uses a new worker and ignores stale callbacks',async()=>{
 const workers=[],client=new SpeechClient(()=>{const w=new WorkerFixture();workers.push(w);return w;},()=>{});const first=client.call('status');workers[0].onerror();await assert.rejects(first,/runtime/);assert.equal(workers[0].terminated,true);
 const retry=client.call('status');assert.equal(workers.length,2);workers[0].onerror();workers[0].onmessage({data:{id:workers[0].messages[0].id,value:'stale'}});workers[1].onmessage({data:{id:workers[1].messages[0].id,value:true}});assert.equal(await retry,true);
 const pending=client.call('transcribe');client.stop();await assert.rejects(pending,/Stopped/);
});
test('microphone requests are synchronous gated and late grants/rejections cannot affect the next recording',async()=>{
 const gate=new MicrophoneGate(),a=deferred(),b=deferred();let called=0,stopped=0;const old=gate.acquire(()=>{called++;return a.promise;});assert.equal(await gate.acquire(()=>{called++;return b.promise;}),undefined);assert.equal(called,1);
 gate.cancel();const next=gate.acquire(()=>b.promise);b.resolve({getTracks:()=>[]});assert.ok(await next);a.reject(Error('Old permission rejected'));assert.equal(await old,undefined);
 const late=deferred(),result=gate.acquire(()=>late.promise);gate.cancel();late.resolve({getTracks:()=>[{stop:()=>stopped++}]});assert.equal(await result,undefined);assert.equal(stopped,1);
});
test('review save locks synchronously and distinguishes committed data from a refresh failure',async()=>{
 let locked=false,writes=0;const commit=deferred();const run=()=>saveReviewedTranscript(()=>{if(locked)return false;locked=true;return true;},()=>locked=false,async()=>{writes++;return commit.promise;},async()=>{throw Error('Refresh failed');});const a=run(),b=run();assert.equal(await b,undefined);commit.resolve({id:'saved1'});const result=await a;assert.equal(writes,1);assert.equal(result.note.id,'saved1');assert.equal(result.refreshError,'Refresh failed');assert.equal(locked,false);
});


test('read-only speech status does not advertise processing busy while worker exclusion remains intact',async()=>{
 const w=new WorkerFixture(),updates=[],client=new SpeechClient(()=>w,(busy,progress)=>updates.push({busy,progress}));
 const status=client.call('status');assert.equal(updates.at(-1).busy,false);
 await assert.rejects(client.call('transcribe'),/busy/);assert.equal(w.messages.length,1);
 w.onmessage({data:{id:w.messages[0].id,progress:'Checking'}});assert.equal(updates.at(-1).busy,false);
 w.onmessage({data:{id:w.messages[0].id,value:false}});assert.equal(await status,false);
 for(const operation of ['prepare','transcribe']){
  const pending=client.call(operation);assert.equal(updates.at(-1).busy,true);
  w.onmessage({data:{id:w.messages.at(-1).id,progress:'Working'}});assert.equal(updates.at(-1).busy,true);
  w.onmessage({data:{id:w.messages.at(-1).id,value:true}});await pending;assert.equal(updates.at(-1).busy,false);
 }
});

test('speech inference releases its worker before delivering the transcript and recreates only on request',async()=>{
 const workers=[],events=[],client=new SpeechClient(()=>{const w=new WorkerFixture();const terminate=w.terminate.bind(w);w.terminate=()=>{terminate();events.push('released');};workers.push(w);return w;},()=>{});
 const status=client.call('status');workers[0].onmessage({data:{id:workers[0].messages.at(-1).id,value:true}});assert.equal(await status,true);assert.equal(workers[0].terminated,false);
 const first=client.call('transcribe').then(value=>{events.push('delivered');return value;});const old=workers[0];old.onmessage({data:{id:old.messages.at(-1).id,value:{text:'Original transcript'}}});
 assert.deepEqual(await first,{text:'Original transcript'});assert.equal(old.terminated,true);assert.deepEqual(events,['released','delivered']);assert.equal(workers.length,1);
 const next=client.call('transcribe');assert.equal(workers.length,2);old.onmessage({data:{id:workers[1].messages.at(-1).id,value:{text:'stale'}}});workers[1].onmessage({data:{id:workers[1].messages.at(-1).id,value:{text:'New transcript'}}});assert.deepEqual(await next,{text:'New transcript'});assert.equal(workers[1].terminated,true);
});

test('failed transcription releases its worker without replay and ignores late progress',async()=>{
 const workers=[],updates=[],client=new SpeechClient(()=>{const w=new WorkerFixture();workers.push(w);return w;},(busy,progress)=>updates.push({busy,progress}));
 const first=client.call('transcribe');const old=workers[0];old.onmessage({data:{id:old.messages.at(-1).id,error:'Decode failed'}});await assert.rejects(first,/Decode failed/);assert.equal(old.terminated,true);assert.equal(workers.length,1);
 const count=updates.length;old.onmessage({data:{id:old.messages.at(-1).id,progress:'late'}});assert.equal(updates.length,count);
 const retry=client.call('status');assert.equal(workers.length,2);workers[1].onmessage({data:{id:workers[1].messages.at(-1).id,value:true}});assert.equal(await retry,true);assert.equal(workers[1].terminated,false);
});
