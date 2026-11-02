import test from 'node:test';
import assert from 'node:assert/strict';
import {requireVisionWebGPU} from '../src/vision-webgpu.ts';

test('image model capability preflight requests the high-performance adapter',async()=>{
 let options;
 await requireVisionWebGPU({requestAdapter:async value=>{options=value;return {};}});
 assert.deepEqual(options,{powerPreference:'high-performance'});
});

test('image model capability preflight explains browsers without WebGPU or a compatible adapter',async()=>{
 await assert.rejects(requireVisionWebGPU(undefined),/not available.*needs WebGPU/i);
 await assert.rejects(requireVisionWebGPU({requestAdapter:async()=>null}),/No compatible WebGPU adapter.*needs WebGPU/i);
});

test('image model capability preflight bounds a stalled browser adapter request',async()=>{
 await assert.rejects(requireVisionWebGPU({requestAdapter:()=>new Promise(()=>{})},5),/WebGPU check timed out/);
});

test('image model capability preflight reports adapter API failures as retryable',async()=>{
 await assert.rejects(requireVisionWebGPU({requestAdapter:async()=>{throw Error('GPU process failure');}}),/WebGPU check failed.*retry/);
});

test('Stop cancels a pending image model capability check before runtime acquisition',async()=>{
 const controller=new AbortController(),pending=requireVisionWebGPU({requestAdapter:()=>new Promise(()=>{})},8000,controller.signal);
 controller.abort();
 await assert.rejects(pending,/Stopped/);
});
