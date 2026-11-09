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
