import test from 'node:test';
import assert from 'node:assert/strict';
import {visionAsset,visionManifest,verifyVisionBytes,visionRuntimeResponse,visionReady,prepareVision} from '../src/vision-assets.ts';

test('vision runtime resolves only its immutable revision-pinned manifest files',()=>{
 assert.equal(visionManifest.id,'lfm25-vl-450m-q4f16');
 assert.equal(visionManifest.revision,'24e63007ff1aaafbde27c89eb01a0513f4f61482');
 assert.equal(visionAsset('/vision-model/lfm25-vl-450m/onnx/decoder_model_merged_q4f16.onnx_data')?.bytes,221411328);
 assert.equal(visionAsset('/vision-model/lfm25-vl-450m/config.json')?.url,'https://huggingface.co/onnx-community/LFM2.5-VL-450M-ONNX/resolve/24e63007ff1aaafbde27c89eb01a0513f4f61482/config.json');
 for(const path of ['https://evil.invalid/config.json','/vision-model/lfm25-vl-450m/../config.json','/vision-model/lfm25-vl-450m/onnx/model.onnx','/asr-model/whisper-tiny/config.json'])assert.equal(visionAsset(path),undefined);
});

test('vision weights are hash and size checked before caching or returning',()=>{
 const file=visionManifest.files.find(f=>f.path==='config.json');
 assert.throws(()=>verifyVisionBytes(file,new Uint8Array(file.bytes)),/vision asset verification/i);
 assert.throws(()=>verifyVisionBytes({bytes:2,sha256:file.sha256},new Uint8Array([1,2])),/vision asset verification/i);
});

test('missing local vision assets produce a terminal response instead of a network fallback',async()=>{
 const path='/vision-model/lfm25-vl-450m/config.json',response=await visionRuntimeResponse(path,async()=>{throw Error('missing');});
 assert.equal(response.status,404);assert.equal(await response.text(),'Vision asset unavailable');
});

test('vision readiness requires every pinned asset, and offline preparation never fetches missing files',async()=>{
 const prior=globalThis.caches,priorLocation=globalThis.location,priorFetch=globalThis.fetch,store=new Map();
 const cache={match:async key=>store.get(key)?.clone(),put:async(key,value)=>store.set(key,value.clone())};
 globalThis.caches={open:async()=>cache};Object.defineProperty(globalThis,'location',{configurable:true,value:new URL('https://local.invalid/')});
 try{
  assert.equal(await visionReady(),false);
  let requests=0;globalThis.fetch=async()=>{requests++;throw Error('network forbidden');};
  await assert.rejects(prepareVision(false,new AbortController().signal,()=>{}),/vision model not prepared/i);
  assert.equal(requests,0);assert.equal(await visionReady(),false);
 }finally{globalThis.caches=prior;if(priorLocation===undefined)delete globalThis.location;else Object.defineProperty(globalThis,'location',{configurable:true,value:priorLocation});globalThis.fetch=priorFetch;}
});
