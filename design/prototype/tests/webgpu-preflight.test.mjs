import test from 'node:test';
import assert from 'node:assert/strict';
import {requestHighPerformanceAdapter} from '../../../dist/webgpu-preflight.js';
import {PreparedGgufAdapter} from '../../../dist/lfm-adapter.js';

test('WebGPU preflight requests the high-performance adapter',async()=>{
 let options;const adapter={};
 assert.equal(await requestHighPerformanceAdapter({requestAdapter:async value=>{options=value;return adapter;}}),adapter);
 assert.deepEqual(options,{powerPreference:'high-performance'});
});

test('missing, rejected, and timed-out adapter checks use the fallback error code',async()=>{
 for(const [gpu,timeoutMs,message] of [
  [undefined,10,/WebGPU unavailable/],
  [{requestAdapter:async()=>null},10,/WebGPU unavailable/],
  [{requestAdapter:async()=>{throw Error('GPU process closed');}},10,/WebGPU check failed/],
  [{requestAdapter:()=>new Promise(()=>{})},5,/WebGPU check timed out/],
 ]){
  await assert.rejects(requestHighPerformanceAdapter(gpu,{timeoutMs}),error=>error.code==='webgpu_unavailable'&&message.test(error.message));
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
