import test from 'node:test';
import assert from 'node:assert/strict';
import {checkTextDevice,describeTextDeviceCheck} from '../src/text-device-check.ts';
import {textExecutionRoute} from '../src/text-execution-route.ts';

const storage=(quota,usage=0)=>({estimate:async()=>({quota,usage}),persisted:async()=>false});

test('a large WebGPU model reports only observed adapter and quota evidence',async()=>{
 const check=await checkTextDevice('9B',[],false,{storage:storage(500_000_000),gpu:{requestAdapter:async()=>({})}});
 assert.equal(check.backend,'webgpu');assert.equal(check.webgpu,'available');assert.equal(check.storage,'below-file-size');assert.ok(check.modelBytes>check.availableBytes);
 assert.match(describeTextDeviceCheck(check),/Reported storage below model file size.*WebGPU adapter detected.*Loading and generation untested/);
 const missing=await checkTextDevice('9B',[],false,{storage:storage(3_000_000_000),gpu:{requestAdapter:async()=>null}});
 assert.equal(missing.webgpu,'unavailable');assert.equal(missing.storage,'estimate-covers-file');
});

test('CPU/WASM models do not probe WebGPU and existing files do not need a second free copy',async()=>{
 let probed=false;
 const check=await checkTextDevice('lfm25-230m-qad-q4-0',[],true,{storage:storage(100,90),gpu:{requestAdapter:async()=>{probed=true;return null;}}});
 assert.equal(check.backend,'cpu-wasm');assert.equal(check.webgpu,'not-needed');assert.equal(check.storage,'already-present');assert.equal(probed,false);
 const onnx=await checkTextDevice('smollm2-360m-instruct',[],false,{storage:storage(10_000_000_000),gpu:{requestAdapter:async()=>{probed=true;return null;}}});
 assert.equal(onnx.backend,'cpu-wasm');assert.equal(onnx.webgpu,'not-needed');assert.equal(probed,false);
});

test('device diagnostics and model hints share adapter-derived routes instead of model-name rules',async()=>{
 const base=await checkTextDevice('4B',[],true,{storage:storage(1_000),gpu:{requestAdapter:async()=>({})}});
 assert.equal(base.backend,'webgpu');
 const record=(id,engine)=>({id,label:id,role:'text',engine,revision:'sha256:'+'a'.repeat(64),file:{bytes:24,sha256:'a'.repeat(64)},contextTokens:2048,inspection:{}});
 const qwen3=record('local-qwen3','wllama-qwen3'),qwen35=record('local-qwen35','webml-qwen35');
 assert.deepEqual(textExecutionRoute(qwen3.id,[qwen3]),{engine:'wllama-qwen3',backend:'cpu-wasm'});
 assert.deepEqual(textExecutionRoute(qwen35.id,[qwen35]),{engine:'webml-qwen35',backend:'webgpu'});
 const custom=await checkTextDevice(qwen3.id,[qwen3],true,{storage:storage(100)});
 assert.equal(custom.backend,'cpu-wasm');assert.equal(custom.webgpu,'not-needed');
 assert.equal(textExecutionRoute('unknown-model'),null);
 await assert.rejects(checkTextDevice('unknown-model',[],true,{storage:storage(100)}),/route unavailable/);
});

test('unavailable estimates stay unknown and no unsupported model is certified',async()=>{
 const check=await checkTextDevice('4B',[],false,{storage:{},gpu:{requestAdapter:async()=>{throw Error('GPU unavailable');}}});
 assert.equal(check.storage,'unknown');assert.equal(check.webgpu,'unknown');
 await assert.rejects(checkTextDevice('unknown',[],false,{storage:{}}),/route unavailable/);
});
