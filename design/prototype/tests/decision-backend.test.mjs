import test from 'node:test';
import assert from 'node:assert/strict';
import {decisionBackendForModel} from '../src/decision-backend.ts';

test('built-in D1 Q8 skips unsupported WebGPU MatMulNBits session creation',()=>{
 assert.deepEqual(decisionBackendForModel({modelId:'d1-omni-600M',quantization:'q8',webgpuAvailable:true}),{backend:'wasm',reason:'D1 Q8 MatMulNBits is unsupported by this WebGPU runtime'});
});
test('D1 graphs that contain GatherBlockQuantized are routed to its verified WASM provider',()=>{
 assert.deepEqual(decisionBackendForModel({modelId:'custom-decision',requiresGatherBlockQuantized:true,webgpuAvailable:true}),{backend:'wasm',reason:'GatherBlockQuantized is unsupported by this WebGPU runtime'});
});
test('other configured Decision models can use WebGPU when an adapter is available',()=>{
 assert.deepEqual(decisionBackendForModel({modelId:'custom-decision',quantization:'q4',webgpuAvailable:true}),{backend:'webgpu'});
});
test('WASM remains the explicit fallback when WebGPU is unavailable',()=>{
 assert.deepEqual(decisionBackendForModel({modelId:'custom-decision',webgpuAvailable:false}),{backend:'wasm',reason:'WebGPU unavailable'});
});
