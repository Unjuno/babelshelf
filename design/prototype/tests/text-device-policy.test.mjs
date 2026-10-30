import test from 'node:test';
import assert from 'node:assert/strict';
import {textBackendPolicy} from '../src/text-device-policy.ts';
import {createLfmTextRuntime} from '../src/lfm-text-runtime.ts';

test('registered text engines use capability-driven GPU-first routing without user-agent gating',()=>{
 assert.equal(textBackendPolicy(),'auto');
});

test('GPU-first routing falls back to CPU/WASM when WebGPU becomes unavailable during load',async()=>{
 const calls=[],file=new Blob(['weights']);
 const adapter={loaded:null,supportsExactCount:true,maxReplyTokens:128,
  async preflightBackend(backend){calls.push(['preflight',backend]);},
  async load(_file,id,{backend}){calls.push(['load',backend]);if(backend==='webgpu'){const error=Error('WebGPU unavailable');error.code='webgpu_unavailable';throw error;}adapter.loaded=id;},
  async unload(){calls.push(['unload']);},abort(){},async count(){return 1;},async generate(){return {text:''};}};
 const manifest={contextTokens:2048,runtime:{revision:'test'},models:[{id:'test',revision:'test',contextTokens:2048,file:{name:'test.gguf',bytes:file.size}}]};
 const runtime=createLfmTextRuntime({adapter,manifest,readFile:async()=>file,readAssets:()=>({test:{filesPresent:true}}),backend:textBackendPolicy()});
 const loaded=await runtime.load('test');
 assert.equal(loaded.executionBackend,'cpu-wasm');
 assert.deepEqual(calls,[['preflight','webgpu'],['unload'],['load','webgpu'],['preflight','cpu'],['load','cpu']]);
});
