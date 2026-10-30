import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareProductRuntimeAssets,productRuntimeAssetInput,verifyProductRuntimeAssets} from '../src/product-runtime-assets.ts';

function fakeChannel(){const state={};const port1={onmessage:null,closed:false,close(){this.closed=true;}},port2={};state.channel={port1,port2};return state;}
function fakeWorker(channel,onMessage){const messages=[];return {messages,postMessage(message,transfer){messages.push(message);if(onMessage)onMessage(message,transfer,channel);}};}

test('runtime preparation uses an exact feature role and returns aggregate verified progress without paths',async()=>{
 const channel=fakeChannel(),progress=[],worker=fakeWorker(channel,(message,_transfer,state)=>{assert.deepEqual(message,{type:'prepare-product-assets',role:'speech',operationId:'test-op-0001',acquire:true});queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'progress',role:'speech',completed:1,total:2,bytes:100}}));queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'prepared',role:'speech',assets:2,bytes:200}}));});
 const result=await prepareProductRuntimeAssets('speech',{worker,operationId:'test-op-0001',makeChannel:()=>channel.channel,onProgress:value=>progress.push(value)});
 assert.deepEqual(result,{status:'prepared',role:'speech',assets:2,bytes:200});assert.equal(progress.length,1);assert.equal(channel.channel.port1.closed,true);
});
test('runtime preparation accepts progress while the first file is still downloading',async()=>{
 const channel=fakeChannel(),progress=[],worker=fakeWorker(channel,(_message,_transfer,state)=>{queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'progress',role:'speech',completed:0,total:1,bytes:3}}));queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'prepared',role:'speech',assets:1,bytes:7}}));});
 const result=await prepareProductRuntimeAssets('speech',{worker,operationId:'stream-op-01',makeChannel:()=>channel.channel,onProgress:value=>progress.push(value)});
 assert.equal(result.bytes,7);assert.deepEqual(progress.map(value=>value.completed),[0]);
});

test('load-time runtime verification explicitly forbids acquisition and fails on missing assets',async()=>{
 const channel=fakeChannel(),worker=fakeWorker(channel,(message,_transfer,state)=>{assert.equal(message.acquire,false);queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'failed',error:'Runtime not prepared'}}));});
 await assert.rejects(verifyProductRuntimeAssets('text-onnx',{worker,operationId:'verify-op-01',makeChannel:()=>channel.channel}),/Runtime not prepared/);
});
test('local-only runtime verification exposes real read progress without permitting a download',async()=>{
 const channel=fakeChannel(),progress=[],worker=fakeWorker(channel,(message,_transfer,state)=>{assert.equal(message.acquire,false);queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'progress',role:'pdf',completed:0,total:1,bytes:1024}}));queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'prepared',role:'pdf',assets:1,bytes:4096}}));});
 const result=await verifyProductRuntimeAssets('pdf',{worker,operationId:'local-progress-01',makeChannel:()=>channel.channel,onProgress:value=>progress.push(value)});
 assert.equal(result.bytes,4096);assert.deepEqual(progress.map(value=>value.bytes),[1024]);
});

test('stopping a runtime preparation revokes its worker operation and rejects without retry',async()=>{
 const channel=fakeChannel(),controller=new AbortController(),worker=fakeWorker(channel,()=>{}),pending=prepareProductRuntimeAssets('pdf',{worker,signal:controller.signal,operationId:'stop-op-0001',makeChannel:()=>channel.channel});
 controller.abort();await assert.rejects(pending,/Stopped/);assert.equal(worker.messages.length,2);assert.equal(worker.messages[0].type,'prepare-product-assets');assert.equal(worker.messages[1].type,'cancel-product-assets');
});
test('silent runtime preparation and local verification time out and cancel the pending worker job',async()=>{
 for(const operation of [prepareProductRuntimeAssets,verifyProductRuntimeAssets]){
  const channel=fakeChannel(),worker=fakeWorker(channel),pending=operation('text-lfm3',{worker,operationId:'timeout-op-01',makeChannel:()=>channel.channel,timeoutMs:10});
  await assert.rejects(pending,/timed out/i);
  assert.deepEqual(worker.messages.map(message=>message.type),['prepare-product-assets','cancel-product-assets']);
  assert.equal(worker.messages[1].operationId,'timeout-op-01');assert.equal(channel.channel.port1.closed,true);
 }
});
test('unexpected or mismatched runtime replies cannot claim preparation success',async()=>{
 for(const reply of [{status:'other'},{status:'prepared',role:'speech',assets:1,bytes:20},{status:'prepared',role:'pdf',assets:0,bytes:0}]){
  const channel=fakeChannel(),worker=fakeWorker(channel,(_message,_transfer,state)=>queueMicrotask(()=>state.channel.port1.onmessage({data:reply})));
  await assert.rejects(verifyProductRuntimeAssets('pdf',{worker,operationId:'invalid-op-01',makeChannel:()=>channel.channel,timeoutMs:100}),/invalid.*runtime/i);
 }
});

test('load-time runtime verification can use the active app service worker without custom options',async()=>{
 const original=globalThis.navigator,channel=fakeChannel();
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serviceWorker:{controller:fakeWorker(channel,(_message,_transfer,state)=>queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'prepared',role:'text-wllama',assets:2,bytes:300}})))}}});
 try{assert.deepEqual(await verifyProductRuntimeAssets('text-wllama',{makeChannel:()=>channel.channel}),{status:'prepared',role:'text-wllama',assets:2,bytes:300});}
 finally{Object.defineProperty(globalThis,'navigator',{configurable:true,value:original});}
});

import {runtimeRoleForModelEngine,runtimeRoleForPreparation} from '../src/product-runtime-assets.ts';

test('maps only known browser runtime engines to their pinned bundles',()=>{
 assert.equal(runtimeRoleForModelEngine('transformers-causal-wasm'),'text-onnx');
 assert.equal(runtimeRoleForModelEngine('transformers-causal-webgpu'),'text-onnx');
 assert.equal(runtimeRoleForModelEngine('wllama-cpu-count'),'text-wllama');assert.equal(runtimeRoleForModelEngine('wllama-qwen3-cpu'),'text-wllama');assert.equal(runtimeRoleForModelEngine('wllama-qwen3'),'text-wllama');assert.equal(runtimeRoleForModelEngine('wllama-lfm2'),'text-wllama');
 assert.equal(runtimeRoleForModelEngine('wllama-lfm3'),'text-lfm3');
 assert.equal(runtimeRoleForModelEngine('webml-qwen35'),null);
 assert.equal(runtimeRoleForModelEngine('unknown-engine'),null);
});

test('maps each preparation action to its exact optional runtime role',()=>{
 assert.equal(runtimeRoleForPreparation('decision'),'decision');
 assert.equal(runtimeRoleForPreparation('speech'),'speech');
 assert.equal(runtimeRoleForPreparation('vision'),'vision');
 assert.equal(runtimeRoleForPreparation('ocr'),'ocr');
 assert.equal(runtimeRoleForPreparation('pdf'),'pdf');
 assert.equal(productRuntimeAssetInput('custom-tools',false).feature,'custom-tools');assert.equal(productRuntimeAssetInput('custom-tools',false).allowNetwork,false);
});

test('runtime processing input uses a fixed feature identity and explicit network permission',()=>{
 assert.deepEqual(productRuntimeAssetInput('text-onnx',false),{source:{name:'ONNX text runtime'},role:'runtime',feature:'text-onnx',runtime:{name:'BabelShelf app assets',revision:'build-pinned'},allowNetwork:false,method:'local-only'});
 assert.equal(productRuntimeAssetInput('pdf',true).allowNetwork,true);assert.throws(()=>productRuntimeAssetInput('arbitrary-code',true));
});

test('offline local GGUF preparation does not require the inference runtime',async()=>{
 const {prepareTextAssets}=await import('../src/product-runtime-assets.ts');
 const calls=[];
 await prepareTextAssets({role:'text-lfm3',downloads:false,verifyOnly:false,hasLocalFiles:true,ensureRuntime:async()=>{throw Error('Runtime not prepared');},prepare:async()=>{calls.push('saved');},verify:async()=>{throw Error('unexpected verify');}});
 assert.deepEqual(calls,['saved']);
});

test('other text preparation paths still require the runtime before accessing model assets',async()=>{
 const {prepareTextAssets}=await import('../src/product-runtime-assets.ts');
 for(const opts of [{role:'text-lfm3',downloads:true,verifyOnly:false,hasLocalFiles:true},{role:'text-lfm3',downloads:false,verifyOnly:false,hasLocalFiles:false},{role:'text-onnx',downloads:false,verifyOnly:false,hasLocalFiles:true}]){
  const calls=[];await assert.rejects(prepareTextAssets({...opts,ensureRuntime:async()=>{calls.push('runtime');throw Error('missing runtime');},prepare:async()=>calls.push('prepare'),verify:async()=>calls.push('verify')}),/missing runtime/);assert.deepEqual(calls,['runtime']);
 }
});

test('offline verification of stored GGUF does not require the inference runtime',async()=>{
 const {prepareTextAssets}=await import('../src/product-runtime-assets.ts');const calls=[];
 await prepareTextAssets({role:'text-lfm3',downloads:false,verifyOnly:true,hasLocalFiles:false,ensureRuntime:async()=>{throw Error('Runtime not prepared');},prepare:async()=>{throw Error('unexpected prepare');},verify:async()=>{calls.push('verified');}});
 assert.deepEqual(calls,['verified']);
});
