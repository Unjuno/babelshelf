import test from 'node:test';
import assert from 'node:assert/strict';
import {checkTextDevice} from '../src/text-device-check.ts';

const storage=(quota,usage=0)=>({estimate:async()=>({quota,usage}),persisted:async()=>false});

test('a large WebGPU model reports only observed adapter and quota evidence',async()=>{
 const check=await checkTextDevice('9B',[],false,{storage:storage(500_000_000),gpu:{requestAdapter:async()=>({})}});
 assert.equal(check.backend,'webgpu');assert.equal(check.webgpu,'available');assert.equal(check.storage,'below-file-size');assert.ok(check.modelBytes>check.availableBytes);
 const missing=await checkTextDevice('9B',[],false,{storage:storage(3_000_000_000),gpu:{requestAdapter:async()=>null}});
 assert.equal(missing.webgpu,'unavailable');assert.equal(missing.storage,'estimate-covers-file');
});

test('CPU/WASM models do not probe WebGPU and existing files do not need a second free copy',async()=>{
 let probed=false;
 const check=await checkTextDevice('lfm25-230m-qad-q4-0',[],true,{storage:storage(100,90),gpu:{requestAdapter:async()=>{probed=true;return null;}}});
 assert.equal(check.backend,'cpu-wasm');assert.equal(check.webgpu,'not-needed');assert.equal(check.storage,'already-present');assert.equal(probed,false);
});

test('unavailable estimates stay unknown and no unsupported model is certified',async()=>{
 const check=await checkTextDevice('4B',[],false,{storage:{},gpu:{requestAdapter:async()=>{throw Error('GPU unavailable');}}});
 assert.equal(check.storage,'unknown');assert.equal(check.webgpu,'unknown');
 await assert.rejects(checkTextDevice('unknown',[],false,{storage:{}}),/size unavailable/);
});
