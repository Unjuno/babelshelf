import test from 'node:test';
import assert from 'node:assert/strict';
import {createSemanticEmbeddingClient} from '../src/semantic-embedding-client.ts';
import {createSemanticEmbeddingBackend} from '../src/semantic-embedding-backend.ts';

class FakeWorker{
 onmessage=null;onerror=null;onmessageerror=null;terminated=false;messages=[];reply=true;
 postMessage(message){this.messages.push(message);if(!this.reply)return;queueMicrotask(()=>this.onmessage?.({data:this.response(message)}));}
 response(message){
  if(message.cmd==='embed')return {id:message.id,type:'done',value:[new Float32Array(384).fill(0.5)]};
  if(message.cmd==='load'||message.cmd==='unload'||message.cmd==='verify')return {id:message.id,type:'done',value:true};
  if(message.cmd==='status')return {id:message.id,type:'done',value:{filesPresent:true}};
  if(message.cmd==='prepare')return {id:message.id,type:'done',value:{downloadedBytes:0,downloadedAssets:0,assetCount:5}};
  return {id:message.id,type:'error',value:'Unsupported test command'};
 }
 terminate(){this.terminated=true;}
}

test('embedding client keeps model control explicit and returns typed vectors',async()=>{
 const worker=new FakeWorker(),client=createSemanticEmbeddingClient(worker);
 await assert.rejects(client.embed(['query']),/not loaded/);
 assert.deepEqual(await client.status(),{filesPresent:true});
 const prepared=await client.prepare(false);
 assert.equal(prepared.assetCount,5);assert.equal(worker.messages.at(-1).args.allowNetwork,false);
 await client.load();assert.equal(client.loaded,true);
 const vectors=await client.embed(['日本語の検索語']);assert.equal(vectors.length,1);assert.ok(vectors[0] instanceof Float32Array);assert.equal(vectors[0].length,384);
 await client.unload();assert.equal(client.loaded,false);
 assert.deepEqual(worker.messages.map(message=>message.cmd),['status','prepare','load','embed','unload']);
});

test('embedding client validates the small fixed batch before dispatch',async()=>{
 const worker=new FakeWorker(),client=createSemanticEmbeddingClient(worker);await client.load();
 const count=worker.messages.length;
 await assert.rejects(client.embed([]),/1–8/);
 await assert.rejects(client.embed(Array.from({length:9},()=> 'text')),/1–8/);
 await assert.rejects(client.embed(['  ']),/1–8/);
 assert.equal(worker.messages.length,count);
});

test('hard Stop rejects pending RPCs and terminates only its dedicated worker',async()=>{
 const worker=new FakeWorker();worker.reply=false;const client=createSemanticEmbeddingClient(worker);
 const pending=client.status();client.abort();
 await assert.rejects(pending,/Stopped/);assert.equal(worker.terminated,true);
 await assert.rejects(client.status(),/stopped/);
});

test('backend Stop retires its worker and allows a fresh local retry',async()=>{
 const workers=[];const createWorker=()=>{const worker=new FakeWorker();if(!workers.length)worker.reply=false;workers.push(worker);return worker;};
 const backend=createSemanticEmbeddingBackend(createWorker),controller=new AbortController();
 const pending=backend.status(controller.signal);await Promise.resolve();controller.abort();
 await assert.rejects(pending,/Stopped/);assert.equal(workers[0].terminated,true);
 assert.deepEqual(await backend.status(),{filesPresent:true});assert.equal(workers.length,2);
 await backend.close();await assert.rejects(backend.status(),/closed/);
});

test('a silent model load has a bounded deadline and can be retried with a new worker',async()=>{
 const first=new FakeWorker();first.reply=false;const client=createSemanticEmbeddingClient(first,{loadTimeoutMs:1000});
 await assert.rejects(client.load(),/timed out/);assert.equal(first.terminated,true);
 const retryWorker=new FakeWorker(),retry=createSemanticEmbeddingClient(retryWorker);
 await retry.load();assert.equal(retry.loaded,true);
});

test('backend serializes overlapping requests without cancelling the active request',async()=>{
 const worker=new FakeWorker();worker.reply=false;const backend=createSemanticEmbeddingBackend(()=>worker);
 const first=backend.status();await new Promise(resolve=>setTimeout(resolve,0));
 const second=backend.status();await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(worker.messages.length,1);const a=worker.messages[0];worker.onmessage({data:{id:a.id,type:'done',value:{filesPresent:true}}});
 assert.deepEqual(await first,{filesPresent:true});await new Promise(resolve=>setTimeout(resolve,0));assert.equal(worker.messages.length,2);
 const b=worker.messages[1];worker.onmessage({data:{id:b.id,type:'done',value:{filesPresent:false}}});assert.deepEqual(await second,{filesPresent:false});await backend.close();
});

test('cancelling a queued request does not terminate another request',async()=>{
 const worker=new FakeWorker();worker.reply=false;const backend=createSemanticEmbeddingBackend(()=>worker),controller=new AbortController();
 const first=backend.status();await new Promise(resolve=>setTimeout(resolve,0));const second=backend.status(controller.signal);controller.abort();
 await assert.rejects(second,/Stopped/);assert.equal(worker.terminated,false);assert.equal(worker.messages.length,1);
 const a=worker.messages[0];worker.onmessage({data:{id:a.id,type:'done',value:{filesPresent:true}}});assert.deepEqual(await first,{filesPresent:true});await backend.close();
});

test('closing a backend stops active and waiting requests without starting the latter',async()=>{
 const worker=new FakeWorker();worker.reply=false;const backend=createSemanticEmbeddingBackend(()=>worker);
 const first=backend.status();const firstFailure=assert.rejects(first,/Stopped/);await new Promise(resolve=>setTimeout(resolve,0));
 const second=backend.status();const secondFailure=assert.rejects(second,/Stopped/);await backend.close();await Promise.all([firstFailure,secondFailure]);
 assert.equal(worker.terminated,true);assert.equal(worker.messages.length,1);await assert.rejects(backend.status(),/closed/);
});

test('failure of one request does not poison the next queued request',async()=>{
 const worker=new FakeWorker();worker.reply=false;const backend=createSemanticEmbeddingBackend(()=>worker);
 const first=backend.status();const firstFailure=assert.rejects(first,/test failure/);await new Promise(resolve=>setTimeout(resolve,0));
 const second=backend.status();worker.onmessage({data:{id:worker.messages[0].id,type:'error',value:'test failure'}});await firstFailure;
 await new Promise(resolve=>setTimeout(resolve,0));worker.onmessage({data:{id:worker.messages[1].id,type:'done',value:{filesPresent:true}}});assert.deepEqual(await second,{filesPresent:true});await backend.close();
});

test('stopping the active request lets a waiting request start on a fresh worker',async()=>{
 const workers=[];const backend=createSemanticEmbeddingBackend(()=>{const worker=new FakeWorker();worker.reply=workers.length>0;workers.push(worker);return worker;});
 const controller=new AbortController(),first=backend.status(controller.signal),failure=assert.rejects(first,/Stopped/);
 await new Promise(resolve=>setTimeout(resolve,0));const second=backend.status();controller.abort();await failure;
 assert.deepEqual(await second,{filesPresent:true});assert.equal(workers.length,2);assert.equal(workers[0].terminated,true);await backend.close();
});

test('superseded Memory embedding discards its result without unloading the model',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serviceWorker:{controller:{postMessage(_message,[port]){port.postMessage({status:'prepared',role:'search',assets:1,bytes:1});port.close();}}}}});
 try{
  const worker=new FakeWorker(),backend=createSemanticEmbeddingBackend(()=>worker);await backend.load();worker.reply=false;
  const controller=new AbortController(),stale=backend.embed(['old query'],controller.signal,undefined,true),failure=assert.rejects(stale,/Stopped/);
  await new Promise(resolve=>setTimeout(resolve,0));const embed=worker.messages.at(-1);assert.equal(embed.cmd,'embed');controller.abort();await failure;assert.equal(worker.terminated,false);
  const later=backend.status();worker.onmessage({data:worker.response(embed)});await new Promise(resolve=>setTimeout(resolve,0));const status=worker.messages.at(-1);assert.equal(status.cmd,'status');worker.onmessage({data:worker.response(status)});
  assert.deepEqual(await later,{filesPresent:true});assert.equal(backend.loaded,true);await backend.close();
 }finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
});
