import test from 'node:test';
import assert from 'node:assert/strict';
import {isPhoneDevice,textBackendPolicy,assertTextRouteAllowed} from '../src/text-device-policy.ts';
import {createLfmTextRuntime} from '../src/lfm-text-runtime.ts';

test('phone text inference requires WebGPU; desktop retains explicit CPU routes',()=>{
 for(const device of [{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X)'},{userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel) Mobile'},{userAgent:'Android 15'},{userAgent:'',mobile:true}]){
  assert.equal(isPhoneDevice(device),true);
  assert.equal(textBackendPolicy(device),'webgpu');
  assert.throws(()=>assertTextRouteAllowed({backend:'cpu-wasm'},device),/WebGPU/);
  assert.doesNotThrow(()=>assertTextRouteAllowed({backend:'webgpu'},device));
 }
 for(const device of [{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'},{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)'},{}]){
  assert.equal(isPhoneDevice(device),false);
  assert.equal(textBackendPolicy(device),'auto');
  assert.doesNotThrow(()=>assertTextRouteAllowed({backend:'cpu-wasm'},device));
 }
});

test('phone policy does not fall back to CPU when WebGPU disappears during load',async()=>{
 const calls=[],file=new Blob(['weights']);
 const adapter={loaded:null,supportsExactCount:true,maxReplyTokens:128,
  async preflightBackend(backend){calls.push(['preflight',backend]);},
  async load(_file,_id,{backend}){calls.push(['load',backend]);const error=Error('WebGPU unavailable');error.code='webgpu_unavailable';throw error;},
  async unload(){calls.push(['unload']);},abort(){},async count(){return 1;},async generate(){return {text:''};}};
 const manifest={contextTokens:2048,runtime:{revision:'test'},models:[{id:'test',revision:'test',contextTokens:2048,file:{name:'test.gguf',bytes:file.size}}]};
 const runtime=createLfmTextRuntime({adapter,manifest,readFile:async()=>file,readAssets:()=>({test:{filesPresent:true}}),backend:textBackendPolicy({userAgent:'iPhone'})});
 await assert.rejects(runtime.load('test'),/WebGPU unavailable/);
 assert.deepEqual(calls,[['preflight','webgpu'],['unload'],['load','webgpu']]);
});
