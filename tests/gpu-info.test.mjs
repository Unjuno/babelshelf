import test from 'node:test';
import assert from 'node:assert/strict';
import {adapterSnapshot} from '../dist/gpu-info.js';
test('GPU adapter report contains cloneable plain data even for platform objects',()=>{
 const info=Object.create(null);Object.defineProperty(info,'vendor',{get:()=> 'vendor',enumerable:false});info.uncloneable=()=>{};
 const result=adapterSnapshot({info,features:new Set(['shader-f16']),limits:{maxBufferSize:1024,maxStorageBufferBindingSize:512}});
 assert.deepEqual(structuredClone(result),result);assert.equal(result.info.vendor,'vendor');assert.equal(result.available,true);assert.deepEqual(result.features,['shader-f16']);
});
