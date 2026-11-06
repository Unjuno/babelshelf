import test from 'node:test';
import assert from 'node:assert/strict';
import {probeDecisionWebGPU} from '../src/decision-webgpu.ts';

test('Decision GPU probe requests a high-performance adapter but reports only availability',async()=>{
 let options;assert.equal(await probeDecisionWebGPU({requestAdapter:async value=>{options=value;return {};}}), 'available');assert.deepEqual(options,{powerPreference:'high-performance'});
 assert.equal(await probeDecisionWebGPU({requestAdapter:async()=>null}),'unavailable');
 assert.equal(await probeDecisionWebGPU({requestAdapter:()=>{throw Error('GPU service stopped');}}),'unavailable');
});

test('Decision GPU probe retries default browser adapter selection after a null preferred result',async()=>{
 const calls=[];assert.equal(await probeDecisionWebGPU({requestAdapter:async options=>{calls.push(options);return calls.length===1?null:{};}}),'available');
 assert.deepEqual(calls,[{powerPreference:'high-performance'},{}]);
});

test('Decision GPU probe times out and lets its caller continue to WASM',async()=>{
 assert.equal(await probeDecisionWebGPU({requestAdapter:()=>new Promise(()=>{})},5),'timed-out');
});

test('Stop interrupts a pending Decision GPU probe promptly',async()=>{
 const controller=new AbortController(),pending=probeDecisionWebGPU({requestAdapter:()=>new Promise(()=>{})},8000,controller.signal);controller.abort();await assert.rejects(pending,/Stopped/);
});

test('Decision GPU probe validates its deadline and checks a pre-aborted signal',async()=>{
 await assert.rejects(probeDecisionWebGPU({requestAdapter:async()=>null},0),/Invalid WebGPU check timeout/);
 const controller=new AbortController();controller.abort();await assert.rejects(probeDecisionWebGPU({requestAdapter:async()=>null},8000,controller.signal),/Stopped/);
});
