import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createLocalGgufAssetStore} from '../src/local-gguf-asset-store.ts';
const bytes=new Uint8Array(30).fill(1),sha=createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const files=new Map(),writes=[];
 const directory={async getFileHandle(name,{create=false}={}){
  if(!files.has(name)){if(!create)throw new DOMException('missing','NotFoundError');files.set(name,new Blob([]));}
  return {getFile:async()=>files.get(name),async createWritable(){let data=[];return {
   async write(chunk){writes.push(name);data.push(chunk instanceof Blob?new Uint8Array(await chunk.arrayBuffer()):new Uint8Array(chunk));},
   async close(){files.set(name,new Blob(data));},async abort(){data=[];}
  };}};
 }};
 const model={id:'local-'+sha,label:'My LFM2',engine:'wllama-lfm2',revision:'sha256:'+sha,file:{bytes:bytes.length,sha256:sha}};return {files,writes,directory,model};
}
test('local custom weights import and verify by content hash without any network acquisition',async()=>{
 const f=fixture(),store=createLocalGgufAssetStore(f.model,{directory:async()=>f.directory}),signal=new AbortController().signal;
 await assert.rejects(store.read(signal),/missing/);await assert.rejects(store.prepare(false,signal,()=>[],[]),/Choose one/);
 await store.prepare(false,signal,()=>{},[new File([bytes],'renamed.gguf')]);assert.equal((await store.status(signal)).filesPresent,true);assert.deepEqual([...new Uint8Array(await(await store.read(signal)).arrayBuffer())],[...bytes]);assert.ok(f.writes.length>0);
});
test('a genuinely absent OPFS entry imports even when Chromium uses its File System Access missing-entry error text',async()=>{
 const f=fixture(),original=f.directory.getFileHandle.bind(f.directory);f.directory.getFileHandle=async(name,options)=>{if(!options?.create&&!f.files.has(name))throw new DOMException('A requested file or directory could not be found at the time an operation was processed.','NotFoundError');return original(name,options);};
 const store=createLocalGgufAssetStore(f.model,{directory:async()=>f.directory});await store.prepare(false,new AbortController().signal,()=>{},[new File([bytes],'model.gguf')]);assert.equal((await store.status(new AbortController().signal)).filesPresent,true);assert.ok(f.writes.length>0);
});
test('mismatched local bytes cannot be registered or written',async()=>{
 const f=fixture(),store=createLocalGgufAssetStore(f.model,{directory:async()=>f.directory});await assert.rejects(store.prepare(false,new AbortController().signal,()=>{},[new File([[9,9]],'wrong.gguf')]),/verification/);assert.equal(f.writes.length,0);assert.equal(f.files.has(sha),false);
});
test('cancelling while opening the local model writer aborts the writer',async()=>{
 const f=fixture(),controller=new AbortController(),original=f.directory.getFileHandle.bind(f.directory);let aborted=false;
 f.directory.getFileHandle=async(name,options)=>{const handle=await original(name,options);if(options?.create)return {...handle,createWritable:async()=>{controller.abort();return {abort:async()=>{aborted=true;}};}};return handle;};
 const store=createLocalGgufAssetStore(f.model,{directory:async()=>f.directory});
 await assert.rejects(store.prepare(false,controller.signal,()=>{},[new File([bytes],'model.gguf')]),{name:'AbortError'});
 assert.equal(aborted,true);
});
test('an existing model file read failure is not treated as an absent model',async()=>{
 const f=fixture(),failure=new DOMException('File access denied','NotAllowedError');let created=false;
 f.directory.getFileHandle=async(_name,options)=>{if(options?.create)created=true;return {getFile:async()=>{throw failure;}};};
 const store=createLocalGgufAssetStore(f.model,{directory:async()=>f.directory}),signal=new AbortController().signal;
 await assert.rejects(store.status(signal),error=>error===failure);
 await assert.rejects(store.prepare(false,signal,()=>{},[new File([bytes],'model.gguf')]),error=>error===failure);
 assert.equal(created,false);
});
test('a denied model handle lookup is not treated as an absent model',async()=>{
 const f=fixture(),failure=new DOMException('Access denied','NotAllowedError');let created=false;
 f.directory.getFileHandle=async(_name,options)=>{if(options?.create)created=true;throw failure;};
 const store=createLocalGgufAssetStore(f.model,{directory:async()=>f.directory}),signal=new AbortController().signal;
 await assert.rejects(store.prepare(false,signal,()=>{},[new File([bytes],'model.gguf')]),error=>error===failure);assert.equal(created,false);
});
test('a read failure after a successful status check does not replace existing weights',async()=>{
 const f=fixture(),failure=new DOMException('Access denied','NotAllowedError');let reads=0,created=false;
 f.directory.getFileHandle=async(_name,options)=>{if(options?.create)created=true;return {getFile:async()=>{if(++reads===1)return new Blob([bytes]);throw failure;}};};
 const store=createLocalGgufAssetStore(f.model,{directory:async()=>f.directory});
 await assert.rejects(store.prepare(false,new AbortController().signal,()=>{},[new File([bytes],'model.gguf')]),error=>error===failure);assert.equal(created,false);
});
