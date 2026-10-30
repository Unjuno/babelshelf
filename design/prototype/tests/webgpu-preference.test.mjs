import test from 'node:test';
import assert from 'node:assert/strict';
import {preferHighPerformanceAdapterRequests} from '../src/webgpu-preference.ts';

test('the runtime-owned adapter request gets the high-performance hint when omitted',async()=>{
 const calls=[],gpu={tag:'gpu',requestAdapter:async function(options){assert.equal(this.tag,'gpu');calls.push(options);return 'adapter';}};
 assert.equal(preferHighPerformanceAdapterRequests(gpu),true);
 assert.equal(await gpu.requestAdapter(),'adapter');
 assert.deepEqual(calls,[{powerPreference:'high-performance'}]);
});

test('explicit adapter power preference and other options are preserved without mutating input',async()=>{
 const calls=[],gpu={requestAdapter:async options=>{calls.push(options);return options;}};
 preferHighPerformanceAdapterRequests(gpu);
 const options={powerPreference:'low-power',forceFallbackAdapter:false},returned=await gpu.requestAdapter(options);
 assert.deepEqual(returned,options);assert.notEqual(returned,options);assert.deepEqual(options,{powerPreference:'low-power',forceFallbackAdapter:false});
 assert.equal((await gpu.requestAdapter({forceFallbackAdapter:true})).powerPreference,'high-performance');
 assert.deepEqual(calls,[returned,{forceFallbackAdapter:true,powerPreference:'high-performance'}]);
});

test('unavailable or non-configurable GPU objects remain usable and report no patch',()=>{
 assert.equal(preferHighPerformanceAdapterRequests(undefined),false);
 const gpu={requestAdapter(){return Promise.resolve(null);}};Object.defineProperty(gpu,'requestAdapter',{configurable:false});
 assert.equal(preferHighPerformanceAdapterRequests(gpu),false);
 assert.equal(typeof gpu.requestAdapter,'function');
});
