import test from 'node:test';
import assert from 'node:assert/strict';
import {preferHighPerformanceAdapterRequests,requestAdapterWithFallback} from '../src/webgpu-preference.ts';

test('the runtime-owned adapter request gets the high-performance hint when omitted',async()=>{
 const calls=[],gpu={tag:'gpu',requestAdapter:async function(options){assert.equal(this.tag,'gpu');calls.push(options);return 'adapter';}};
 assert.equal(preferHighPerformanceAdapterRequests(gpu),true);
 assert.equal(await gpu.requestAdapter(),'adapter');
 assert.deepEqual(calls,[{powerPreference:'high-performance'}]);
});

test('a null high-performance result retries the browser default adapter selection',async()=>{
 const calls=[],gpu={tag:'gpu',requestAdapter:async function(options){assert.equal(this.tag,'gpu');calls.push(options);return calls.length===1?null:'default-adapter';}};
 preferHighPerformanceAdapterRequests(gpu);
 assert.equal(await gpu.requestAdapter({forceFallbackAdapter:false}),'default-adapter');
 assert.deepEqual(calls,[{forceFallbackAdapter:false,powerPreference:'high-performance'},{forceFallbackAdapter:false}]);
});

test('a rejected high-performance request retries once without the preference',async()=>{
 const calls=[],gpu={requestAdapter:async options=>{calls.push(options);if(calls.length===1)throw Error('High-performance adapter unavailable');return 'default-adapter';}};
 preferHighPerformanceAdapterRequests(gpu);
 assert.equal(await gpu.requestAdapter(),'default-adapter');
 assert.deepEqual(calls,[{powerPreference:'high-performance'},{}]);
});

test('Stop after a pending preferred request prevents the compatibility retry',async()=>{
 let resolvePreferred;const calls=[],controller=new AbortController(),gpu={requestAdapter:options=>{calls.push(options);return new Promise(resolve=>{resolvePreferred=resolve;});}};
 const pending=requestAdapterWithFallback(gpu,undefined,controller.signal);await Promise.resolve();controller.abort();resolvePreferred(null);
 await assert.rejects(pending,/Stopped/);assert.deepEqual(calls,[{powerPreference:'high-performance'}]);
});

test('explicit adapter power preference and other options are preserved without mutating input',async()=>{
 const calls=[],gpu={requestAdapter:async options=>{calls.push(options);return options;}};
 preferHighPerformanceAdapterRequests(gpu);
 const options={powerPreference:'low-power',forceFallbackAdapter:false},returned=await gpu.requestAdapter(options);
 assert.deepEqual(returned,options);assert.notEqual(returned,options);assert.deepEqual(options,{powerPreference:'low-power',forceFallbackAdapter:false});
 assert.equal((await gpu.requestAdapter({forceFallbackAdapter:true})).powerPreference,'high-performance');
 assert.deepEqual(calls,[returned,{forceFallbackAdapter:true,powerPreference:'high-performance'}]);
});

test('an explicit low-power preference is not overridden or retried',async()=>{
 const calls=[],gpu={requestAdapter:async options=>{calls.push(options);return null;}};
 preferHighPerformanceAdapterRequests(gpu);
 assert.equal(await gpu.requestAdapter({powerPreference:'low-power'}),null);
 assert.deepEqual(calls,[{powerPreference:'low-power'}]);
});

test('unavailable or non-configurable GPU objects remain usable and report no patch',()=>{
 assert.equal(preferHighPerformanceAdapterRequests(undefined),false);
 const gpu={requestAdapter(){return Promise.resolve(null);}};Object.defineProperty(gpu,'requestAdapter',{configurable:false});
 assert.equal(preferHighPerformanceAdapterRequests(gpu),false);
 assert.equal(typeof gpu.requestAdapter,'function');
});
