import test from 'node:test';
import assert from 'node:assert/strict';
import {configureLocalTransformerRuntime} from '../src/transformers-runtime.ts';

function runtime(){return {useWasmCache:true,backends:{onnx:{wasm:{proxy:true,wasmPaths:null}}}};}

test('local transformer runtime leaves ONNX Runtime thread selection automatic',()=>{
 const value=runtime();
 configureLocalTransformerRuntime(value,'/runtime.wasm','/runtime.mjs');
 assert.equal(value.backends.onnx.wasm.numThreads,undefined);
 assert.equal(value.backends.onnx.wasm.proxy,false);
 assert.deepEqual(value.backends.onnx.wasm.wasmPaths,{wasm:'/runtime.wasm',mjs:'/runtime.mjs'});
 assert.equal(value.useWasmCache,false);
});

test('local transformer runtime preserves an explicit thread policy supplied by its owner',()=>{
 const value=runtime();value.backends.onnx.wasm.numThreads=2;
 configureLocalTransformerRuntime(value,'/runtime.wasm','/runtime.mjs');
 assert.equal(value.backends.onnx.wasm.numThreads,2);
});
