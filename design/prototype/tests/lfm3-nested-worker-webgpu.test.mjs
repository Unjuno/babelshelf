import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import {createLfm3WorkerAwareBlobClass} from '../src/lfm3-nested-worker-webgpu.ts';

test('only the Wllama llama.cpp worker receives the high-performance adapter preference',async()=>{
 const WorkerBlob=createLfm3WorkerAwareBlobClass(Blob);
 const plain=await new WorkerBlob(['ordinary worker'],{type:'text/javascript'}).text();
 const wasmModule=await new WorkerBlob(['function wModuleInit() {}'],{type:'text/javascript'}).text();
 assert.equal(plain,'ordinary worker');
 assert.equal(wasmModule,'function wModuleInit() {}');

 const source='const RUN_OPTIONS = {}; function wModuleInit() {}';
 const workerSource=await new WorkerBlob([source],{type:'text/javascript'}).text();
 assert.notEqual(workerSource,source);
 const prelude=workerSource.slice(0,workerSource.indexOf(source));
 const requested=[];
 const navigatorObject={gpu:{requestAdapter(options){requested.push(options);return Promise.resolve(requested.length===1?null:{device:'test'});}}};
 const scope={navigator:navigatorObject};
 vm.runInNewContext(prelude,{globalThis:scope});
 const adapter=await navigatorObject.gpu.requestAdapter();
 assert.deepEqual(adapter,{device:'test'});
 assert.equal(requested.length,2);
 assert.equal(requested[0].powerPreference,'high-performance');
 assert.equal(requested[1],undefined);
});

test('explicit low-power WebGPU requests remain unchanged',async()=>{
 const WorkerBlob=createLfm3WorkerAwareBlobClass(Blob);
 const source='const RUN_OPTIONS = {}; function wModuleInit() {}';
 const workerSource=await new WorkerBlob([source],{type:'text/javascript'}).text();
 const prelude=workerSource.slice(0,workerSource.indexOf(source));
 const requested=[];
 const navigatorObject={gpu:{requestAdapter(options){requested.push(options);return Promise.resolve({device:'test'});}}};
 vm.runInNewContext(prelude,{globalThis:{navigator:navigatorObject}});
 await navigatorObject.gpu.requestAdapter({powerPreference:'low-power'});
 assert.deepEqual(requested,[{powerPreference:'low-power'}]);
});
