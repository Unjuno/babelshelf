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

test('load-time runtime verification explicitly forbids acquisition and fails on missing assets',async()=>{
 const channel=fakeChannel(),worker=fakeWorker(channel,(message,_transfer,state)=>{assert.equal(message.acquire,false);queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'failed',error:'Runtime not prepared'}}));});
 await assert.rejects(verifyProductRuntimeAssets('text-onnx',{worker,operationId:'verify-op-01',makeChannel:()=>channel.channel}),/Runtime not prepared/);
});

test('stopping a runtime preparation revokes its worker operation and rejects without retry',async()=>{
 const channel=fakeChannel(),controller=new AbortController(),worker=fakeWorker(channel,()=>{}),pending=prepareProductRuntimeAssets('pdf',{worker,signal:controller.signal,operationId:'stop-op-0001',makeChannel:()=>channel.channel});
 controller.abort();await assert.rejects(pending,/Stopped/);assert.equal(worker.messages.length,2);assert.equal(worker.messages[0].type,'prepare-product-assets');assert.equal(worker.messages[1].type,'cancel-product-assets');
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
