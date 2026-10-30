import test from 'node:test';
import assert from 'node:assert/strict';
import {isPhoneDevice,textBackendPolicy,assertTextRouteAllowed} from '../src/text-device-policy.ts';

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
