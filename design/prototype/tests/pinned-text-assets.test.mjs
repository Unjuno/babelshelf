import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPinnedAssetStore} from '../src/pinned-text-assets.ts';
import {writeOpfsRange} from '../src/opfs-range-writer.ts';
const bytes=new Uint8Array([1,2,3]),sha256=createHash('sha256').update(bytes).digest('hex');
const manifest={id:'test-model',revision:'a'.repeat(40),runtime:{revision:'test-runtime'},files:[{path:'onnx/model_quantized.onnx',url:'https://huggingface.co/test/resolve/'+ 'a'.repeat(40)+'/model.onnx',bytes:3,sha256}]};
function fixture() {
 const files=new Map(); let fetches=0,writers=0;
 const directory={
  async getFileHandle(name,{create=false}={}) {
   if(!files.has(name)){if(!create)throw new DOMException('missing','NotFoundError');files.set(name,new Blob([]));}
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
test('pinned preparation counts network transfer bytes and reports local reuse as zero',async()=>{
 const f=fixture(),signal=new AbortController().signal,phases=[];const progress=(_done,_total,phase)=>phases.push(phase);
 const first=await f.store.prepare(true,signal,progress);assert.deepEqual(first,{downloadedBytes:3,downloadedAssets:1,assetCount:1});assert.deepEqual(new Set(phases),new Set(['downloading']));phases.length=0;
 const second=await f.store.prepare(true,signal,progress);assert.deepEqual(second,{downloadedBytes:0,downloadedAssets:0,assetCount:1});assert.equal(f.fetches,1);assert.deepEqual(new Set(phases),new Set(['verifying']));
});
test('a streamed LFM3 GGUF digest marks the committed OPFS snapshot for the next worker load',async()=>{
 const lfmManifest={...manifest,id:'lfm3-1.7b-qad-q4-0',files:[{...manifest.files[0],path:'model.gguf'}]},files=new Map();
 const directory={async getFileHandle(name,{create=false}={}){if(!files.has(name)){if(!create)throw new DOMException('missing','NotFoundError');files.set(name,new Blob([]));}return {getFile:async()=>new File([files.get(name)],name,{lastModified:123}),async createWritable(){let pending=[];return {async write(value){pending.push(typeof value==='string'?value:value);},async close(){files.set(name,new Blob(pending));},async abort(){pending=[];}};}};},async removeEntry(name){if(!files.delete(name))throw new DOMException('missing','NotFoundError');}};
 const store=createPinnedAssetStore(lfmManifest,{directory:async()=>directory,fetch:async()=>new Response(bytes)}),marker=sha256+'.verified-v1.json';
 await store.prepare(true,new AbortController().signal);assert.ok(files.has(marker),'verified committed GGUF snapshot gets a cache marker');
});
test('large pinned ONNX resumes after an interrupted request from its last committed range',async()=>{
 const rangeBytes=16*1024*1024,all=new Uint8Array(rangeBytes+37);for(let i=0;i<all.length;i++)all[i]=i%251;
 const digest=createHash('sha256').update(all).digest('hex'),pin={path:'onnx/model_quantized.onnx',url:'https://huggingface.co/test/resolve/'+ 'a'.repeat(40)+'/onnx/model_quantized.onnx',bytes:all.length,sha256:digest},files=new Map(),ranges=[];
 const handle={async getFile(){return files.get(digest)??new Blob([]);},async createWritable(){let data=new Uint8Array(await (files.get(digest)??new Blob([])).arrayBuffer()),position=0;return {async seek(value){position=value;},async truncate(value){data=data.slice(0,value);position=Math.min(position,value);},async write(value){const chunk=new Uint8Array(value),next=new Uint8Array(Math.max(data.length,position+chunk.length));next.set(data);next.set(chunk,position);data=next;position+=chunk.length;},async close(){files.set(digest,new Blob([data]));},async abort(){}};}};
 const directory={async getFileHandle(name,{create=false}={}){assert.equal(name,digest);if(!create&&!files.has(name))throw new DOMException('missing','NotFoundError');return handle;}};
 const manifest={id:'lfm3-1.7b-qad-q4-0',revision:'a'.repeat(40),runtime:{revision:'test-runtime'},files:[pin]};let secondRangeAttempts=0;
 const fetch=async(_url,options)=>{const range=options.headers.Range,m=/bytes=(\d+)-(\d+)/.exec(range),start=Number(m[1]),end=Number(m[2]);ranges.push(range);const headers={'content-range':`bytes ${start}-${end}/${all.length}`,'content-length':String(end-start+1)};
  if(start===rangeBytes&&secondRangeAttempts++===0){let sent=false;return new Response(new ReadableStream({pull(controller){if(!sent){sent=true;controller.enqueue(all.subarray(start,start+5));}else controller.error(new TypeError('connection reset'));}}),{status:206,headers});}
  return new Response(all.subarray(start,end+1),{status:206,headers});
 };
 const store=createPinnedAssetStore(manifest,{directory:async()=>directory,fetch}),signal=new AbortController().signal;
 await assert.rejects(store.prepare(true,signal),/connection reset/);assert.equal(files.get(digest).size,rangeBytes,'only the complete first range is durable');
 const phases=[],resumed=await store.prepare(true,signal,(done,total,phase)=>phases.push({done,total,phase}));assert.equal(resumed.downloadedBytes,37);assert.deepEqual(ranges,[`bytes=0-${rangeBytes-1}`,`bytes=${rangeBytes}-${all.length-1}`,`bytes=${rangeBytes}-${all.length-1}`]);
 assert.deepEqual(phases[0],{done:rangeBytes,total:all.length,phase:'downloading'});assert.equal(phases.at(-1).phase,'verifying');assert.equal(phases.at(-1).done,all.length);
 assert.equal((await store.status(signal)).filesPresent,true);assert.deepEqual(new Uint8Array(await(await store.read('onnx/model_quantized.onnx',signal)).arrayBuffer()),all);
});
test('storage quota failure is actionable and preserves completed model ranges',async()=>{
 const rangeBytes=16*1024*1024,all=new Uint8Array(rangeBytes+1),digest=createHash('sha256').update(all).digest('hex'),pin={path:'model.gguf',url:'https://huggingface.co/test/resolve/'+ 'a'.repeat(40)+'/model.gguf',bytes:all.length,sha256:digest},files=new Map();
 const quotaError=new DOMException('The operation failed because it would cause the application to exceed its storage quota.','QuotaExceededError');
 const handle={async getFile(){return files.get(digest)??new Blob([]);},async createWritable(){const existing=files.get(digest)??new Blob([]);if(existing.size>=rangeBytes)throw quotaError;let data=new Uint8Array(await existing.arrayBuffer()),position=0;return {async seek(value){position=value;},async truncate(value){data=data.slice(0,value);position=Math.min(position,value);},async write(value){const chunk=new Uint8Array(value),next=new Uint8Array(Math.max(data.length,position+chunk.length));next.set(data);next.set(chunk,position);data=next;position+=chunk.length;},async close(){files.set(digest,new Blob([data]));},async abort(){}};}};
 const directory={async getFileHandle(name,{create=false}={}){if(!create&&!files.has(name))throw new DOMException('missing','NotFoundError');if(create&&!files.has(name))files.set(name,new Blob([]));return handle;},async removeEntry(name){if(!files.delete(name))throw new DOMException('missing','NotFoundError');}};
 const store=createPinnedAssetStore({...manifest,id:'lfm3-1.7b-qad-q4-0',files:[pin]},{directory:async()=>directory,fetch:async(_url,options)=>{const match=/bytes=(\d+)-(\d+)/.exec(options.headers.Range),start=Number(match[1]),end=Number(match[2]),body=all.subarray(start,end+1);return new Response(body,{status:206,headers:{'content-range':`bytes ${start}-${end}/${all.length}`,'content-length':String(body.length)}});}});
 await assert.rejects(store.prepare(true,new AbortController().signal),error=>error.code==='storage-quota-exceeded'&&/effective storage limit can be lower than the estimate/i.test(error.message)&&/completed download ranges remain/i.test(error.message)&&error.downloadedBytes===rangeBytes);
 assert.equal(files.get(digest).size,rangeBytes,'the last fully committed range remains available for retry');
});
test('dedicated-worker OPFS writer resumes after a crash without rewriting aligned model ranges',async()=>{
 const rangeBytes=16*1024*1024,all=new Uint8Array(rangeBytes+37);for(let i=0;i<all.length;i++)all[i]=i%251;
 const digest=createHash('sha256').update(all).digest('hex'),pin={path:'model.gguf',url:'https://huggingface.co/test/resolve/'+ 'a'.repeat(40)+'/model.gguf',bytes:all.length,sha256:digest};
 const files=new Map([[digest,new Uint8Array([...all.subarray(0,rangeBytes),9,9,9])]]),ranges=[];
 const handle={async getFile(){return new Blob([files.get(digest)??new Uint8Array()]);},async createWritable(){throw Error('the direct writer must not stage a second file');},async createSyncAccessHandle(){let closed=false;return {getSize(){return files.get(digest)?.length??0;},truncate(size){const old=files.get(digest)??new Uint8Array();files.set(digest,old.slice(0,size));},write(input,{at}){assert.equal(closed,false);const old=files.get(digest)??new Uint8Array(),chunk=new Uint8Array(input),next=new Uint8Array(Math.max(old.length,at+chunk.length));next.set(old);next.set(chunk,at);files.set(digest,next);return chunk.length;},flush(){assert.equal(closed,false);},close(){closed=true;}};}};
 const directory={async getFileHandle(name,{create=false}={}){if(name!==digest)throw new DOMException('missing','NotFoundError');if(!files.has(name)&&!create)throw new DOMException('missing','NotFoundError');return handle;},async removeEntry(name){files.delete(name);}};
 const store=createPinnedAssetStore({...manifest,id:'lfm3-1.7b-qad-q4-0',files:[pin]},{directory:async()=>directory,fetch:async(_url,options)=>{ranges.push(options.headers.Range);const match=/bytes=(\d+)-(\d+)/.exec(options.headers.Range),start=Number(match[1]),end=Number(match[2]),body=all.subarray(start,end+1);return new Response(body,{status:206,headers:{'content-range':`bytes ${start}-${end}/${all.length}`,'content-length':String(body.length)}});},writeRange:writeOpfsRange});
 const result=await store.prepare(true,new AbortController().signal);assert.equal(result.downloadedBytes,37);assert.deepEqual(ranges,[`bytes=${rangeBytes}-${all.length-1}`]);assert.deepEqual(files.get(digest),all);assert.equal((await store.status(new AbortController().signal)).filesPresent,true);
});
test('a stale range writer refuses both a newer and a shorter committed prefix without changing bytes',async()=>{
 const rangeBytes=16*1024*1024;
 for(const [start,currentSize] of [[rangeBytes,rangeBytes*3],[rangeBytes*3,rangeBytes]]){
  let truncations=0,writes=0,reads=0,closed=false;const signal=new AbortController().signal;
  const handle={async createSyncAccessHandle(){return {getSize:()=>currentSize,truncate(){truncations++;},write(){writes++;return 1;},flush(){},close(){closed=true;}};}};
  const reader={async read(){reads++;return {done:true};},async cancel(){},releaseLock(){}};
  await assert.rejects(writeOpfsRange(handle,start,1,reader,signal,()=>{}),/Model file changed during preparation/);
  assert.equal(truncations,0);assert.equal(writes,0);assert.equal(reads,0);assert.equal(closed,true);
 }
});
test('recovery trim rechecks the committed file size under the access handle before truncating',async()=>{
 const rangeBytes=16*1024*1024,snapshotSize=rangeBytes+1,currentSize=rangeBytes*2,sha=createHash('sha256').update('full').digest('hex'),pin={path:'model.gguf',url:'https://huggingface.co/test/resolve/'+ 'a'.repeat(40)+'/model.gguf',bytes:currentSize+1,sha256:sha};let truncations=0,fetches=0;
 const handle={async getFile(){return new Blob([new Uint8Array(snapshotSize)]);},async createSyncAccessHandle(){return {getSize:()=>currentSize,truncate(){truncations++;},flush(){},close(){}};}};
 const directory={async getFileHandle(){return handle;}};
 const store=createPinnedAssetStore({...manifest,id:'lfm3-1.7b-qad-q4-0',files:[pin]},{directory:async()=>directory,fetch:async()=>{fetches++;throw Error('must not fetch after a stale snapshot');},writeRange:writeOpfsRange});
 await assert.rejects(store.prepare(true,new AbortController().signal),/Model file changed during preparation/);
 assert.equal(currentSize,rangeBytes*2);assert.equal(truncations,0);assert.equal(fetches,0);
});
test('two tabs serialize same-digest verification and local import before a corrupt-file reset',async()=>{
 const rangeBytes=16*1024*1024,all=new Uint8Array(rangeBytes+1);for(let i=0;i<all.length;i++)all[i]=i%251;
 const digest=createHash('sha256').update(all).digest('hex'),corrupt=all.slice();corrupt[0]^=0xff;
 const pin={path:'model.gguf',url:'https://huggingface.co/test/resolve/'+ 'a'.repeat(40)+'/model.gguf',bytes:all.length,sha256:digest},files=new Map([[digest,new Uint8Array(corrupt)]]);
 let fileReads=0,releaseCorruptRead,announceCorruptRead;const corruptGate=new Promise(resolve=>releaseCorruptRead=resolve),corruptRead=new Promise(resolve=>announceCorruptRead=resolve);
 const handle={async getFile(){fileReads++;if(fileReads===2){const snapshot=corrupt.slice();return {size:snapshot.length,stream:()=>new ReadableStream({async pull(controller){announceCorruptRead();await corruptGate;controller.enqueue(snapshot);controller.close();}})};}return new Blob([files.get(digest)??new Uint8Array()]);},async createWritable(options={}){let data=options.keepExistingData?(files.get(digest)??new Uint8Array()).slice():new Uint8Array(),position=0;return {async seek(value){position=value;},async truncate(value){data=data.slice(0,value);position=Math.min(position,value);},async write(value){const chunk=new Uint8Array(value),next=new Uint8Array(Math.max(data.length,position+chunk.length));next.set(data);next.set(chunk,position);data=next;position+=chunk.length;},async close(){files.set(digest,data);},async abort(){}};}};
 const directory={async getFileHandle(name,{create=false}={}){assert.equal(name,digest);if(!create&&!files.has(name))throw new DOMException('missing','NotFoundError');return handle;},async removeEntry(name){files.delete(name);}};
 const lfm={...manifest,id:'lfm3-1.7b-qad-q4-0',files:[pin]},fetch=async(_url,options)=>{const m=/bytes=(\d+)-(\d+)/.exec(options.headers.Range),start=Number(m[1]),end=Number(m[2]),body=all.subarray(start,end+1);return new Response(body,{status:206,headers:{'content-range':`bytes ${start}-${end}/${all.length}`,'content-length':String(body.length)}});};
 const storeA=createPinnedAssetStore(lfm,{directory:async()=>directory,fetch}),storeB=createPinnedAssetStore(lfm,{directory:async()=>directory,fetch:async()=>{throw Error('valid local import must not fetch');}});
 const first=storeA.prepare(true,new AbortController().signal);await corruptRead;
 let secondDone=false;const second=storeB.prepare(false,new AbortController().signal,()=>{},[new File([all],'renamed.gguf')]).then(()=>{secondDone=true;});
 await new Promise(resolve=>setTimeout(resolve,25));assert.equal(secondDone,false,'same-digest local import waits while another tab verifies and repairs the corrupt file');
 releaseCorruptRead();await Promise.all([first,second]);assert.equal(secondDone,true);assert.deepEqual(files.get(digest),all);
});
test('OPFS quota during a range write reports received body bytes and preserves the committed prefix',async()=>{
 const rangeBytes=16*1024*1024,tail=new Uint8Array(37),all=new Uint8Array(rangeBytes+tail.length),digest=createHash('sha256').update(all).digest('hex'),pin={path:'model.gguf',url:'https://huggingface.co/test/resolve/'+ 'a'.repeat(40)+'/model.gguf',bytes:all.length,sha256:digest};
 let stored=all.slice(0,rangeBytes),truncated=0;const quotaError=new DOMException('quota','QuotaExceededError');
 const handle={async getFile(){return new Blob([stored]);},async createSyncAccessHandle(){return {getSize:()=>stored.length,truncate(size){truncated++;stored=stored.slice(0,size);},write(){throw quotaError;},flush(){},close(){}};}};
 const directory={async getFileHandle(name,{create=false}={}){if(name!==digest)throw new DOMException('missing','NotFoundError');if(!create&&!stored.length)throw new DOMException('missing','NotFoundError');return handle;},async removeEntry(){}};
 const store=createPinnedAssetStore({...manifest,id:'lfm3-1.7b-qad-q4-0',files:[pin]},{directory:async()=>directory,fetch:async(_url,options)=>{const range=options.headers.Range;assert.equal(range,`bytes=${rangeBytes}-${all.length-1}`);return new Response(tail,{status:206,headers:{'content-range':`bytes ${rangeBytes}-${all.length-1}/${all.length}`,'content-length':String(tail.length)}});},writeRange:writeOpfsRange});
 await assert.rejects(store.prepare(true,new AbortController().signal),error=>error.code==='storage-quota-exceeded'&&error.downloadedBytes===tail.length);
 assert.equal(stored.length,rangeBytes);assert.equal(truncated,1);
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
 await assert.rejects(store.prepare(true,signal),error=>/verification/.test(error.message)&&error.downloadedBytes===3);
 assert.equal(f.files.get(sha256),before);
});

test('manifest rejects mutable URLs and path traversal before storage access',()=>{
 const io={directory:async()=>{throw Error('must not open storage');},fetch:()=>{throw Error('must not fetch');}};
 assert.throws(()=>createPinnedAssetStore({...manifest,files:[{...manifest.files[0],path:'../model.onnx'}]},io),/Invalid/);
 assert.throws(()=>createPinnedAssetStore({...manifest,files:[{...manifest.files[0],url:'https://huggingface.co/test/resolve/main/model.onnx'}]},io),/Invalid/);
});

test('pinned model IDs may contain decimal points used by versioned model names',()=>{
 const io={directory:async()=>{throw Error('must not open storage');},fetch:()=>{throw Error('must not fetch');}};
 assert.doesNotThrow(()=>createPinnedAssetStore({...manifest,id:'lfm3-1.7b-qad-q4-0'},io));
});

test('download body is cancelled when OPFS cannot open a writer or HTTP fails',async()=>{
 for(const httpFailure of [false,true]){
  let cancelled=0;
  const stream=new ReadableStream({cancel(){cancelled++;}});
  const store=createPinnedAssetStore(manifest,{directory:async()=>({getFileHandle:async(_name,options)=>{if(!options?.create)throw new DOMException('missing','NotFoundError');throw Error('OPFS unavailable');}}),fetch:async()=>new Response(stream,{status:httpFailure?503:200})});
  await assert.rejects(store.prepare(true,new AbortController().signal),/OPFS|download/);
  assert.equal(cancelled,1);
 }
});
test('permission failure is not interpreted as missing or a reason to download',async()=>{
 const error=new DOMException('Denied','NotAllowedError');let fetches=0,creates=0;
 const store=createPinnedAssetStore(manifest,{directory:async()=>({getFileHandle:async(_name,options)=>{if(options?.create)creates++;throw error;}}),fetch:async()=>{fetches++;return new Response(bytes);}}),signal=new AbortController().signal;
 await assert.rejects(store.status(signal),e=>e===error);await assert.rejects(store.prepare(true,signal),e=>e===error);
 assert.equal(fetches,0);assert.equal(creates,0);
});
test('a renamed single GGUF is accepted only when its bytes match the pinned model',async()=>{
 const gguf={...manifest,files:[{...manifest.files[0],path:'model.gguf'}]},f=fixture();let fetches=0;
 const directory={getFileHandle:async(name,options)=>{if(!f.files.has(name)){if(!options?.create)throw new DOMException('missing','NotFoundError');f.files.set(name,new Blob([]));}return {getFile:async()=>f.files.get(name),createWritable:async()=>{const parts=[];return {write:async value=>parts.push(value),close:async()=>f.files.set(name,new Blob(parts)),abort:async()=>{}};}};}};
 const store=createPinnedAssetStore(gguf,{directory:async()=>directory,fetch:async()=>{fetches++;throw Error('unexpected fetch');}}),signal=new AbortController().signal;
 await assert.rejects(store.prepare(true,signal,()=>{},[new File([new Uint8Array([3,2,1])],'renamed.gguf')]),/verification/);assert.equal(fetches,0);
 await store.prepare(false,signal,()=>{},[new File([bytes],'renamed.gguf')]);assert.equal((await store.status(signal)).filesPresent,true);assert.equal(fetches,0);
});
