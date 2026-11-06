import test from 'node:test';
import assert from 'node:assert/strict';
import {requestHighPerformanceAdapter} from '../../../dist/webgpu-preflight.js';
import {PreparedGgufAdapter} from '../../../dist/lfm-adapter.js';

test('WebGPU preflight requests the high-performance adapter',async()=>{
 let options;const adapter={};
 assert.equal(await requestHighPerformanceAdapter({requestAdapter:async value=>{options=value;return adapter;}}),adapter);
 assert.deepEqual(options,{powerPreference:'high-performance'});
});

test('WebGPU preflight retries default adapter selection when high-performance returns null',async()=>{
 const calls=[];
 const adapter=await requestHighPerformanceAdapter({requestAdapter:async options=>{calls.push(options);return calls.length===1?null:'default-adapter';}});
 assert.equal(adapter,'default-adapter');assert.deepEqual(calls,[{powerPreference:'high-performance'},{}]);
});

test('timed-out preferred adapter checks do not retry after a late null or rejection',async()=>{
 for(const lateOutcome of ['null','rejection']){
  let finishPreferred;const calls=[];
  const gpu={requestAdapter:options=>{calls.push(options);return calls.length===1?new Promise((resolve,reject)=>{finishPreferred=lateOutcome==='null'?resolve:()=>reject(Error('late GPU failure'));}):Promise.resolve('default-adapter');}};
  await assert.rejects(requestHighPerformanceAdapter(gpu,{timeoutMs:20}),error=>error.code==='webgpu_check_timeout'&&/timed out/.test(error.message));
  finishPreferred(null);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,[{powerPreference:'high-performance'}]);
 }
});

test('only a missing or null adapter is classified as definitively unavailable',async()=>{
 for(const [gpu,timeoutMs,code,message] of [
  [undefined,10,'webgpu_unavailable',/WebGPU unavailable/],
  [{requestAdapter:async()=>null},10,'webgpu_unavailable',/WebGPU unavailable/],
  [{requestAdapter:async()=>{throw Error('GPU process closed');}},10,'webgpu_check_failed',/WebGPU check failed/],
  [{requestAdapter:()=>new Promise(()=>{})},5,'webgpu_check_timeout',/WebGPU check timed out/],
 ]){
  await assert.rejects(requestHighPerformanceAdapter(gpu,{timeoutMs}),error=>error.code===code&&message.test(error.message));
 }
});

test('Stop aborts a pending adapter check without marking it as unavailable',async()=>{
 const controller=new AbortController(),pending=requestHighPerformanceAdapter({requestAdapter:()=>new Promise(()=>{})},{timeoutMs:8000,signal:controller.signal});
 controller.abort();
 await assert.rejects(pending,error=>error.message==='Stopped'&&error.code===undefined);
});

test('the prepared GGUF adapter connects Stop to its pending WebGPU preflight',async t=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{requestAdapter:()=>new Promise(()=>{})}}});
 t.after(()=>{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;});
 const adapter=new PreparedGgufAdapter({Wllama:class{},paths:{default:'local.wasm'},compat:{wasm:'compat.wasm',worker:{code:''}},models:[],architecture:'lfm3'});
 const pending=adapter.preflightBackend('webgpu');
 adapter.abort();
 await assert.rejects(pending,/Stopped/);
});
