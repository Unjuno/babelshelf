import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createLocalGgufAssetStore} from '../src/local-gguf-asset-store.ts';
const bytes=new Uint8Array(30).fill(1),sha=createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const files=new Map(),writes=[];
 const directory={async getFileHandle(name,{create=false}={}){
  if(!files.has(name)){if(!create)throw Error('missing');files.set(name,new Blob([]));}
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
 const f=fixture(),original=f.directory.getFileHandle.bind(f.directory);f.directory.getFileHandle=async(name,options)=>{if(!options?.create&&!f.files.has(name))throw Error('A requested file or directory could not be found at the time an operation was processed.');return original(name,options);};
 const store=createLocalGgufAssetStore(f.model,{directory:async()=>f.directory});await store.prepare(false,new AbortController().signal,()=>{},[new File([bytes],'model.gguf')]);assert.equal((await store.status(new AbortController().signal)).filesPresent,true);assert.ok(f.writes.length>0);
});
test('mismatched local bytes cannot be registered or written',async()=>{
 const f=fixture(),store=createLocalGgufAssetStore(f.model,{directory:async()=>f.directory});await assert.rejects(store.prepare(false,new AbortController().signal,()=>{},[new File([[9,9]],'wrong.gguf')]),/verification/);assert.equal(f.writes.length,0);assert.equal(f.files.has(sha),false);
});
