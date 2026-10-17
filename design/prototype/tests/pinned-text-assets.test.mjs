import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPinnedAssetStore} from '../src/pinned-text-assets.ts';
const bytes=new Uint8Array([1,2,3]),sha256=createHash('sha256').update(bytes).digest('hex');
const manifest={id:'test-model',revision:'a'.repeat(40),runtime:{revision:'test-runtime'},files:[{path:'onnx/model_quantized.onnx',url:'https://huggingface.co/test/resolve/'+ 'a'.repeat(40)+'/model.onnx',bytes:3,sha256}]};
function fixture() {
 const files=new Map(); let fetches=0,writers=0;
 const directory={
  async getFileHandle(name,{create=false}={}) {
   if(!files.has(name)){if(!create)throw Error('missing');files.set(name,new Blob([]));}
   return {
    getFile:async()=>files.get(name),
    async createWritable() {
     writers++;let pending=[];
     return {
      async write(value){pending.push(typeof value==='string'?new TextEncoder().encode(value):value);},
      async close(){files.set(name,new Blob(pending));},
      async abort(){pending=[];}
     };
    }
   };
  }
 };
 const store=createPinnedAssetStore(manifest,{directory:async()=>directory,fetch:async()=>{fetches++;return new Response(bytes);}});
 return {store,files,get fetches(){return fetches;},get writers(){return writers;}};
}
test('pinned assets never acquire missing data during read or offline preparation',async()=>{
 const f=fixture(),signal=new AbortController().signal;await assert.rejects(f.store.read('onnx/model_quantized.onnx',signal),/missing/);await assert.rejects(f.store.prepare(false,signal),/Downloads/);assert.equal(f.fetches,0);assert.equal(f.writers,0);
});
test('explicit local import is verified, restart status is declarative and reads rehash retained bytes',async()=>{
 const f=fixture(),signal=new AbortController().signal;await f.store.prepare(false,signal,()=>{},[new File([bytes],'model_quantized.onnx')]);assert.equal(f.fetches,0);assert.equal((await f.store.status(signal)).filesPresent,true);assert.deepEqual(new Uint8Array(await(await f.store.read('onnx/model_quantized.onnx',signal)).arrayBuffer()),bytes);
 f.files.set(sha256,new Blob([new Uint8Array([3,2,1])]));await assert.rejects(f.store.read('onnx/model_quantized.onnx',signal),/verification/);assert.equal(f.fetches,0);
});
test('Stop during cached verification cannot create a replacement writer or remove bytes',async()=>{
 const f=fixture(),c=new AbortController();f.files.set(sha256,{size:3,stream:()=>({getReader:()=>({async read(){c.abort();return {done:false,value:bytes};},async cancel(){},releaseLock(){}})})});await assert.rejects(f.store.prepare(true,c.signal),/abort|Stopped/i);assert.equal(f.writers,0);assert.equal(f.fetches,0);assert.ok(f.files.has(sha256));
});

test('corrupt explicit download never commits unverified bytes',async()=>{
 const f=fixture(),signal=new AbortController().signal;
 f.files.set(sha256,new Blob([new Uint8Array([9,9])]));
 const before=f.files.get(sha256);
 const store=createPinnedAssetStore(manifest,{directory:async()=>({async getFileHandle(name){return {getFile:async()=>f.files.get(name),async createWritable(){let pending;return {async write(bytes){pending=bytes;},async close(){f.files.set(name,new Blob([pending]));},async abort(){}};}};}}),fetch:async()=>new Response(new Uint8Array([9,8,7]))});
 await assert.rejects(store.prepare(true,signal),/verification/);
 assert.equal(f.files.get(sha256),before);
});

test('manifest rejects mutable URLs and path traversal before storage access',()=>{
 const io={directory:async()=>{throw Error('must not open storage');},fetch:()=>{throw Error('must not fetch');}};
 assert.throws(()=>createPinnedAssetStore({...manifest,files:[{...manifest.files[0],path:'../model.onnx'}]},io),/Invalid/);
 assert.throws(()=>createPinnedAssetStore({...manifest,files:[{...manifest.files[0],url:'https://huggingface.co/test/resolve/main/model.onnx'}]},io),/Invalid/);
});

test('download body is cancelled when OPFS cannot open a writer or HTTP fails',async()=>{
 for(const httpFailure of [false,true]){
  let cancelled=0;
  const stream=new ReadableStream({cancel(){cancelled++;}});
  const store=createPinnedAssetStore(manifest,{directory:async()=>({getFileHandle:async()=>{throw Error('OPFS unavailable');}}),fetch:async()=>new Response(stream,{status:httpFailure?503:200})});
  await assert.rejects(store.prepare(true,new AbortController().signal),/OPFS|download/);
  assert.equal(cancelled,1);
 }
});
