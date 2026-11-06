import test from 'node:test';
import assert from 'node:assert/strict';
import {textBackendPolicy} from '../src/text-device-policy.ts';
import {createLfmTextRuntime} from '../src/lfm-text-runtime.ts';

test('mobile browsers require the registered WebGPU route while desktop keeps automatic fallback',()=>{
 assert.equal(textBackendPolicy({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) Mobile Safari/605.1'}),'webgpu');
 assert.equal(textBackendPolicy({userAgent:'Mozilla/5.0 (Linux; Android 15) Mobile Safari/605.1'}),'webgpu');
 assert.equal(textBackendPolicy({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1',maxTouchPoints:5}),'webgpu','iPad desktop-mode browsers expose a Mac user agent');
 assert.equal(textBackendPolicy({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156'}),'auto');
 assert.equal(textBackendPolicy({userAgent:'',userAgentData:{mobile:false}}),'auto','unknown devices are not guessed to be mobile');
});

test('desktop automatic routing falls back to CPU/WASM when WebGPU becomes unavailable during load',async()=>{
 const calls=[],file=new Blob(['weights']);
 const adapter={loaded:null,supportsExactCount:true,maxReplyTokens:128,
  async preflightBackend(backend){calls.push(['preflight',backend]);},
  async load(_file,id,{backend}){calls.push(['load',backend]);if(backend==='webgpu'){const error=Error('WebGPU unavailable');error.code='webgpu_unavailable';throw error;}adapter.loaded=id;},
  async unload(){calls.push(['unload']);},abort(){},async count(){return 1;},async generate(){return {text:''};}};
 const manifest={contextTokens:2048,runtime:{revision:'test'},models:[{id:'test',revision:'test',contextTokens:2048,file:{name:'test.gguf',bytes:file.size}}]};
 const runtime=createLfmTextRuntime({adapter,manifest,readFile:async()=>file,readAssets:()=>({test:{filesPresent:true}}),backend:textBackendPolicy()});
 const loaded=await runtime.load('test');
 assert.equal(loaded.executionBackend,'cpu-wasm');
 assert.deepEqual(calls,[['preflight','webgpu'],['unload'],['load','webgpu'],['unload'],['preflight','cpu'],['load','cpu']]);
});

test('mobile WebGPU route reports GPU failure without silently loading the model on CPU',async()=>{
 const calls=[],file=new Blob(['weights']);
 const adapter={loaded:null,supportsExactCount:true,maxReplyTokens:128,
  async preflightBackend(backend){calls.push(['preflight',backend]);if(backend==='webgpu'){const error=Error('WebGPU unavailable');error.code='webgpu_unavailable';throw error;}},
  async load(_file,id,{backend}){calls.push(['load',backend]);adapter.loaded=id;},async unload(){calls.push(['unload']);},abort(){},async count(){return 1;},async generate(){return {text:''};}};
 const manifest={contextTokens:2048,runtime:{revision:'test'},models:[{id:'test',revision:'test',contextTokens:2048,file:{name:'test.gguf',bytes:file.size}}]};
 const backend=textBackendPolicy({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) Mobile'});
 const runtime=createLfmTextRuntime({adapter,manifest,readFile:async()=>file,readAssets:()=>({test:{filesPresent:true}}),backend});
 await assert.rejects(runtime.load('test'),/WebGPU unavailable/);assert.deepEqual(calls,[['preflight','webgpu']]);assert.equal(adapter.loaded,null);
});
