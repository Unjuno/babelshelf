import test from 'node:test';
import assert from 'node:assert/strict';
import {inferenceThreadCount} from '../dist/inference-threads.js';

test('WASM threads remain single-threaded without isolation or shared memory',()=>{
 assert.equal(inferenceThreadCount({isolated:false,sharedMemory:true,hardwareConcurrency:16}),1);
 assert.equal(inferenceThreadCount({isolated:true,sharedMemory:false,hardwareConcurrency:16}),1);
});

test('isolated devices use half the logical cores with a four-thread ceiling',()=>{
 assert.equal(inferenceThreadCount({isolated:true,sharedMemory:true,hardwareConcurrency:1}),1);
 assert.equal(inferenceThreadCount({isolated:true,sharedMemory:true,hardwareConcurrency:2}),1);
 assert.equal(inferenceThreadCount({isolated:true,sharedMemory:true,hardwareConcurrency:6}),3);
 assert.equal(inferenceThreadCount({isolated:true,sharedMemory:true,hardwareConcurrency:64}),4);
});

test('missing or invalid core counts use a conservative two-core estimate',()=>{
 assert.equal(inferenceThreadCount({isolated:true,sharedMemory:true,hardwareConcurrency:NaN}),1);
 assert.equal(inferenceThreadCount({isolated:true,sharedMemory:true,hardwareConcurrency:0}),1);
});
