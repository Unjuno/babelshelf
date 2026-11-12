import test from 'node:test';
import assert from 'node:assert/strict';
import {canReusePreparedRuntime,prepareProductRuntimeAssets,productRuntimeAssetInput,productRuntimeProgressLabel,shouldAcquireRuntimeAfterVerification,verifyProductRuntimeAssets} from '../src/product-runtime-assets.ts';

test('a runtime verified in this session is reused unless an explicit check is requested',()=>{
 assert.equal(canReusePreparedRuntime(false),false);
 assert.equal(canReusePreparedRuntime(true),true);
 assert.equal(canReusePreparedRuntime(true,true),false);
});

test('runtime progress names the current asset count and cumulative verified bytes read',()=>{
 assert.equal(productRuntimeProgressLabel({status:'progress',role:'text-lfm3',completed:0,total:2,bytes:1048576}),'Runtime · 0/2 · 1.0 MB read');
 assert.equal(productRuntimeProgressLabel({status:'progress',role:'text-lfm3',completed:1,total:2,bytes:16777216}),'Runtime · 1/2 · 16.7 MB read');
 assert.equal(productRuntimeProgressLabel({status:'progress',role:'text-lfm3',completed:1,total:4,bytes:16777216,totalBytes:33554432}),'Runtime · 50% · 16.7 / 33.5 MB');
 assert.throws(()=>productRuntimeProgressLabel({status:'progress',role:'text-lfm3',completed:3,total:2,bytes:1}),/Invalid runtime progress/);
 assert.throws(()=>productRuntimeProgressLabel({status:'progress',role:'text-lfm3',completed:0,total:2,bytes:5,totalBytes:4}),/Invalid runtime progress/);
});

function fakeChannel(){const state={};const port1={onmessage:null,closed:false,close(){this.closed=true;}},port2={};state.channel={port1,port2};return state;}
function fakeWorker(channel,onMessage){const messages=[];return {messages,postMessage(message,transfer){messages.push(message);if(onMessage)onMessage(message,transfer,channel);}};}

test('runtime preparation uses an exact feature role and returns aggregate verified progress without paths',async()=>{
 const channel=fakeChannel(),progress=[],worker=fakeWorker(channel,(message,_transfer,state)=>{assert.deepEqual(message,{type:'prepare-product-assets',role:'speech',operationId:'test-op-0001',acquire:true});queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'progress',role:'speech',completed:1,total:2,bytes:100}}));queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'prepared',role:'speech',assets:2,bytes:200,downloadedBytes:120}}));});
 const result=await prepareProductRuntimeAssets('speech',{worker,operationId:'test-op-0001',makeChannel:()=>channel.channel,onProgress:value=>progress.push(value)});
 assert.deepEqual(result,{status:'prepared',role:'speech',assets:2,bytes:200,downloadedBytes:120});assert.equal(progress.length,1);assert.equal(channel.channel.port1.closed,true);
});
test('runtime preparation accepts progress while the first file is still downloading',async()=>{
 const channel=fakeChannel(),progress=[],worker=fakeWorker(channel,(_message,_transfer,state)=>{queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'progress',role:'speech',completed:0,total:1,bytes:3}}));queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'prepared',role:'speech',assets:1,bytes:7}}));});
 const result=await prepareProductRuntimeAssets('speech',{worker,operationId:'stream-op-01',makeChannel:()=>channel.channel,onProgress:value=>progress.push(value)});
 assert.equal(result.bytes,7);assert.deepEqual(progress.map(value=>value.completed),[0]);
});

test('load-time runtime verification explicitly forbids acquisition and fails on missing assets',async()=>{
 const channel=fakeChannel(),worker=fakeWorker(channel,(message,_transfer,state)=>{assert.equal(message.acquire,false);queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'failed',error:'Runtime not prepared'}}));});
 await assert.rejects(verifyProductRuntimeAssets('text-onnx',{worker,operationId:'verify-op-01',makeChannel:()=>channel.channel}),/Unknown app runtime role/);
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
test('runtime progress cannot extend preparation beyond its absolute deadline',async()=>{
 const channel=fakeChannel(),worker=fakeWorker(channel,(_message,_transfer,state)=>{
  setTimeout(()=>state.channel.port1.onmessage({data:{status:'progress',role:'text-lfm3',completed:0,total:1,bytes:1}}),8);
  setTimeout(()=>state.channel.port1.onmessage({data:{status:'progress',role:'text-lfm3',completed:0,total:1,bytes:2}}),16);
 });
 const pending=prepareProductRuntimeAssets('text-lfm3',{worker,operationId:'absolute-time-01',makeChannel:()=>channel.channel,timeoutMs:80,maxDurationMs:30});
 await assert.rejects(pending,error=>error.code==='runtime-timeout'&&/maximum duration/i.test(error.message));
 assert.deepEqual(worker.messages.map(message=>message.type),['prepare-product-assets','cancel-product-assets']);
 assert.equal(channel.channel.port1.closed,true);
});
test('a late success reply after a suspended-page wall-clock deadline is rejected and cancelled',async()=>{
 const channel=fakeChannel(),worker=fakeWorker(channel);let now=Date.now;let current=now();
 Date.now=()=>current;
 try{
  const pending=prepareProductRuntimeAssets('text-lfm3',{worker,operationId:'suspended-wall-clock',makeChannel:()=>channel.channel,timeoutMs:10000,maxDurationMs:30000});
  const rejection=assert.rejects(pending,error=>error.code==='runtime-timeout'&&/maximum duration/i.test(error.message));
  current+=30001;
  channel.channel.port1.onmessage({data:{status:'prepared',role:'text-lfm3',assets:1,bytes:100}});
  await rejection;
  assert.deepEqual(worker.messages.map(message=>message.type),['prepare-product-assets','cancel-product-assets']);
  assert.equal(channel.channel.port1.closed,true);
 }finally{Date.now=now;}
});
test('returning to a suspended page expires a silent runtime operation immediately',async()=>{
 const channel=fakeChannel(),worker=fakeWorker(channel),priorDocument=globalThis.document,handlers=new Map();let now=Date.now;let current=now();
 Object.defineProperty(globalThis,'document',{configurable:true,value:{visibilityState:'visible',addEventListener:(type,listener)=>handlers.set(type,listener),removeEventListener:type=>handlers.delete(type)}});
 Date.now=()=>current;
 try{
  const pending=prepareProductRuntimeAssets('text-lfm3',{worker,operationId:'resume-deadline-01',makeChannel:()=>channel.channel,timeoutMs:10000,maxDurationMs:30000});
  const rejection=assert.rejects(pending,error=>error.code==='runtime-timeout'&&/maximum duration/i.test(error.message));
  current+=30001;handlers.get('visibilitychange')();await rejection;
  assert.deepEqual(worker.messages.map(message=>message.type),['prepare-product-assets','cancel-product-assets']);
  assert.equal(channel.channel.port1.closed,true);assert.equal(handlers.has('visibilitychange'),false);
 }finally{Date.now=now;if(priorDocument===undefined)delete globalThis.document;else Object.defineProperty(globalThis,'document',{configurable:true,value:priorDocument});}
});
test('Full cycle acquires only after an explicit missing-runtime result, never after timeout or unknown errors',()=>{
 assert.equal(shouldAcquireRuntimeAfterVerification(Object.assign(Error('missing'),{code:'runtime-not-prepared'}),true,true),true);
 assert.equal(shouldAcquireRuntimeAfterVerification(Object.assign(Error('slow'),{code:'runtime-timeout'}),true,true),false);
 assert.equal(shouldAcquireRuntimeAfterVerification(Object.assign(Error('not available'),{code:'runtime-unavailable'}),true,true),false);
 assert.equal(shouldAcquireRuntimeAfterVerification(Error('Runtime not prepared · switch Online to prepare'),true,true),false);
 assert.equal(shouldAcquireRuntimeAfterVerification(Object.assign(Error('missing'),{code:'runtime-not-prepared'}),false,true),false);
 assert.equal(shouldAcquireRuntimeAfterVerification(Object.assign(Error('missing'),{code:'runtime-not-prepared'}),true,false),false);
});
test('unexpected or mismatched runtime replies cannot claim preparation success',async()=>{
 for(const reply of [{status:'other'},{status:'prepared',role:'speech',assets:1,bytes:20},{status:'prepared',role:'pdf',assets:0,bytes:0},{status:'prepared',role:'pdf',assets:1,bytes:10,downloadedBytes:11}]){
  const channel=fakeChannel(),worker=fakeWorker(channel,(_message,_transfer,state)=>queueMicrotask(()=>state.channel.port1.onmessage({data:reply})));
  await assert.rejects(verifyProductRuntimeAssets('pdf',{worker,operationId:'invalid-op-01',makeChannel:()=>channel.channel,timeoutMs:100}),/invalid.*runtime/i);
 }
});
test('runtime acquisition failure retains the measured partial payload byte count',async()=>{
 const channel=fakeChannel(),worker=fakeWorker(channel,(_message,_transfer,state)=>queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'failed',error:'Runtime verification failed',downloadedBytes:37}})));
 await assert.rejects(prepareProductRuntimeAssets('pdf',{worker,operationId:'partial-op-01',makeChannel:()=>channel.channel}),error=>error.message==='Runtime verification failed'&&error.downloadedBytes===37);
});
test('runtime failure replies retain only a validated stable diagnostic code',async()=>{
 const channel=fakeChannel(),worker=fakeWorker(channel,(_message,_transfer,state)=>queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'failed',error:'Network unavailable',code:'runtime-network-error',downloadedBytes:12}})));
 await assert.rejects(prepareProductRuntimeAssets('text-lfm3',{worker,operationId:'coded-failure-01',makeChannel:()=>channel.channel}),error=>error.message==='Network unavailable'&&error.code==='runtime-network-error'&&error.downloadedBytes===12);
 const invalidChannel=fakeChannel(),invalidWorker=fakeWorker(invalidChannel,(_message,_transfer,state)=>queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'failed',error:'private raw detail',code:'untrusted-code'}})));
 await assert.rejects(prepareProductRuntimeAssets('text-lfm3',{worker:invalidWorker,operationId:'coded-failure-02',makeChannel:()=>invalidChannel.channel}),/Invalid app runtime response/);
});

test('load-time runtime verification can use the active app service worker without custom options',async()=>{
 const original=globalThis.navigator,channel=fakeChannel();
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serviceWorker:{controller:fakeWorker(channel,(_message,_transfer,state)=>queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'prepared',role:'text-wllama',assets:2,bytes:300}})))}}});
 try{assert.deepEqual(await verifyProductRuntimeAssets('text-wllama',{makeChannel:()=>channel.channel}),{status:'prepared',role:'text-wllama',assets:2,bytes:300});}
 finally{Object.defineProperty(globalThis,'navigator',{configurable:true,value:original});}
});

function pendingController(t){
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),events=new EventTarget(),listeners=new Set();
 const container={controller:null,subscribed:0,
  addEventListener(type,listener){assert.equal(type,'controllerchange');this.subscribed++;listeners.add(listener);events.addEventListener(type,listener);},
  removeEventListener(type,listener){listeners.delete(listener);events.removeEventListener(type,listener);},
  register(){assert.fail('runtime requests must not register a worker');},
  get ready(){assert.fail('controller waiting must be bounded, not serviceWorker.ready');},
 };
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serviceWorker:container}});
 t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;});
 return {container,listeners,arrive(worker){container.controller=worker;events.dispatchEvent(new Event('controllerchange'));}};
}
function preparedWorker(channel){return fakeWorker(channel,(message,_transfer,state)=>{if(message.type==='prepare-product-assets')queueMicrotask(()=>state.channel.port1.onmessage({data:{status:'prepared',role:'pdf',assets:1,bytes:40}}));});}

test('explicit runtime preparation waits for the initial controller, then sends one acquisition request',async t=>{
 const f=pendingController(t),channel=fakeChannel(),worker=preparedWorker(channel);let channels=0;
 const pending=prepareProductRuntimeAssets('pdf',{operationId:'initial-worker-01',controllerTimeoutMs:100,makeChannel:()=>{channels++;return channel.channel;}});
 assert.equal(channels,0);assert.equal(f.listeners.size,1);assert.deepEqual(worker.messages,[]);
 f.arrive(worker);assert.equal((await pending).bytes,40);
 assert.equal(channels,1);assert.equal(worker.messages.length,1);assert.equal(worker.messages[0].acquire,true);assert.equal(f.listeners.size,0);
});

test('a controller arriving during listener installation is observed without another event',async t=>{
 const f=pendingController(t),channel=fakeChannel(),worker=preparedWorker(channel),subscribe=f.container.addEventListener.bind(f.container);
 f.container.addEventListener=(...args)=>{subscribe(...args);f.container.controller=worker;};
 assert.equal((await prepareProductRuntimeAssets('pdf',{controllerTimeoutMs:100,makeChannel:()=>channel.channel})).bytes,40);
 assert.equal(worker.messages.length,1);assert.equal(f.listeners.size,0);
});

test('stopping initial controller waiting cleans listeners and never starts or retries asset work',async t=>{
 const f=pendingController(t),controller=new AbortController(),worker=preparedWorker(fakeChannel());let channels=0;
 const pending=prepareProductRuntimeAssets('pdf',{signal:controller.signal,controllerTimeoutMs:100,makeChannel:()=>{channels++;return fakeChannel().channel;}});
 assert.equal(f.listeners.size,1);controller.abort();
 await assert.rejects(pending,error=>error.code==='stopped'&&error.message==='Stopped');
 assert.equal(f.listeners.size,0);f.arrive(worker);assert.equal(channels,0);assert.deepEqual(worker.messages,[]);
});

test('initial controller waiting has a safe bounded timeout and detaches its abort listener',async t=>{
 const f=pendingController(t),controller=new AbortController(),signal=controller.signal,add=signal.addEventListener.bind(signal),remove=signal.removeEventListener.bind(signal),abortListeners=new Set();let channels=0;
 signal.addEventListener=(type,listener,options)=>{if(type==='abort')abortListeners.add(listener);add(type,listener,options);};
 signal.removeEventListener=(type,listener,options)=>{if(type==='abort')abortListeners.delete(listener);remove(type,listener,options);};
 const pending=prepareProductRuntimeAssets('pdf',{signal,controllerTimeoutMs:10,makeChannel:()=>{channels++;return fakeChannel().channel;}});
 await assert.rejects(pending,error=>error.code==='runtime-timeout'&&error.message==='App worker start timed out · retry preparation');
 assert.equal(f.listeners.size,0);assert.equal(abortListeners.size,0);assert.equal(channels,0);
});

test('verification and explicit worker overrides do not wait for a controller',async t=>{
 const f=pendingController(t),channel=fakeChannel(),worker=preparedWorker(channel);
 await assert.rejects(verifyProductRuntimeAssets('pdf'),error=>error.code==='runtime-unavailable');
 f.container.controller=worker;
 for(const selected of [null,undefined])await assert.rejects(prepareProductRuntimeAssets('pdf',{worker:selected}),error=>error.code==='runtime-unavailable');
 Object.defineProperty(globalThis.navigator,'serviceWorker',{configurable:true,get(){assert.fail('an explicit worker must not inspect browser registration state');}});
 assert.equal((await prepareProductRuntimeAssets('pdf',{worker,makeChannel:()=>channel.channel})).bytes,40);
 assert.equal(f.container.subscribed,0);assert.equal(worker.messages.length,1);
});

test('an already controlling worker needs no controller listener or additional asset request',async t=>{
 const f=pendingController(t),channel=fakeChannel(),worker=preparedWorker(channel);f.container.controller=worker;
 assert.equal((await prepareProductRuntimeAssets('pdf',{makeChannel:()=>channel.channel})).bytes,40);
 assert.equal(f.container.subscribed,0);assert.equal(worker.messages.length,1);
});

test('Stop immediately after controller arrival prevents the acquisition request',async t=>{
 const f=pendingController(t),controller=new AbortController(),worker=preparedWorker(fakeChannel());let channels=0;
 const pending=prepareProductRuntimeAssets('pdf',{signal:controller.signal,controllerTimeoutMs:100,makeChannel:()=>{channels++;return fakeChannel().channel;}});
 f.arrive(worker);controller.abort();await assert.rejects(pending,error=>error.code==='stopped');
 assert.equal(f.listeners.size,0);assert.equal(channels,0);assert.deepEqual(worker.messages,[]);
});

test('a controller arriving after the waiting wall-clock deadline cannot start asset work',async t=>{
 const f=pendingController(t),worker=preparedWorker(fakeChannel()),now=Date.now;let current=now(),channels=0;Date.now=()=>current;
 try{
  const pending=prepareProductRuntimeAssets('pdf',{controllerTimeoutMs:100,makeChannel:()=>{channels++;return fakeChannel().channel;}});
  const rejection=assert.rejects(pending,error=>error.code==='runtime-timeout');current+=101;f.arrive(worker);await rejection;
  assert.equal(f.listeners.size,0);assert.equal(channels,0);assert.deepEqual(worker.messages,[]);
 }finally{Date.now=now;}
});

test('controller waiting cannot be configured to remain unbounded',async t=>{
 const f=pendingController(t);
 for(const controllerTimeoutMs of [0,-1,NaN,Infinity,10001])await assert.rejects(prepareProductRuntimeAssets('pdf',{controllerTimeoutMs}),error=>error.code==='runtime-setup-error');
 assert.equal(f.container.subscribed,0);
});

import {runtimeRoleForModelEngine,runtimeRoleForPreparation} from '../src/product-runtime-assets.ts';

test('maps only known browser runtime engines to their pinned bundles',()=>{
 assert.equal(runtimeRoleForModelEngine('transformers-causal-wasm'),null);
 assert.equal(runtimeRoleForModelEngine('transformers-causal-webgpu'),null);
 assert.equal(runtimeRoleForModelEngine('wllama-cpu-count'),'text-wllama');assert.equal(runtimeRoleForModelEngine('wllama-qwen3-cpu'),'text-wllama');assert.equal(runtimeRoleForModelEngine('wllama-qwen3'),'text-wllama');assert.equal(runtimeRoleForModelEngine('wllama-lfm2'),'text-wllama');
 assert.equal(runtimeRoleForModelEngine('wllama-lfm3'),'text-lfm3');
 assert.equal(runtimeRoleForModelEngine('webml-qwen35'),null);
 assert.equal(runtimeRoleForModelEngine('unknown-engine'),null);
});

test('maps each preparation action to its exact optional runtime role',()=>{
 assert.equal(runtimeRoleForPreparation('decision'),'decision');
 assert.equal(runtimeRoleForPreparation('speech'),'speech');
 assert.equal(runtimeRoleForPreparation('vision'),'vision');
 assert.equal(runtimeRoleForPreparation('search'),'search');
 assert.equal(runtimeRoleForPreparation('ocr'),'ocr');
 assert.equal(runtimeRoleForPreparation('pdf'),'pdf');
 assert.equal(productRuntimeAssetInput('custom-tools',false).feature,'custom-tools');assert.equal(productRuntimeAssetInput('custom-tools',false).allowNetwork,false);
});

test('runtime processing input uses a fixed feature identity and explicit network permission',()=>{
 assert.throws(()=>productRuntimeAssetInput('text-onnx',false),/Unknown app runtime role/);
 assert.equal(productRuntimeAssetInput('pdf',true).allowNetwork,true);assert.throws(()=>productRuntimeAssetInput('arbitrary-code',true));
});

test('offline local GGUF preparation does not require the inference runtime',async()=>{
 const {prepareTextAssets}=await import('../src/product-runtime-assets.ts');
 const calls=[];
 await prepareTextAssets({role:'text-lfm3',downloads:false,verifyOnly:false,hasLocalFiles:true,ensureRuntime:async()=>{throw Error('Runtime not prepared');},prepare:async()=>{calls.push('saved');},verify:async()=>{throw Error('unexpected verify');}});
 assert.deepEqual(calls,['saved']);
});

test('the separate runtime is ready before text model files are prepared',async()=>{
 const {prepareTextAssets}=await import('../src/product-runtime-assets.ts');
 for(const opts of [{role:'text-lfm3',downloads:true,verifyOnly:false,hasLocalFiles:true},{role:'text-lfm3',downloads:false,verifyOnly:false,hasLocalFiles:false}]){
  const calls=[];await assert.rejects(prepareTextAssets({...opts,ensureRuntime:async()=>{calls.push('runtime');throw Error('missing runtime');},prepare:async()=>calls.push('prepare'),verify:async()=>calls.push('verify')}),/missing runtime/);assert.deepEqual(calls,['runtime']);
 }
});

test('runtime preparation completes before model files are acquired',async()=>{
 const {prepareTextAssets}=await import('../src/product-runtime-assets.ts');const calls=[];
 await assert.rejects(prepareTextAssets({role:'text-lfm3',downloads:true,verifyOnly:false,hasLocalFiles:false,ensureRuntime:async()=>{calls.push('runtime');},prepare:async()=>{calls.push('model');throw Error('model transfer failed');},verify:async()=>{}}),/model transfer failed/);
 assert.deepEqual(calls,['runtime','model']);
});

test('local GGUF verification remains independent of the inference runtime',async()=>{
 const {prepareTextAssets}=await import('../src/product-runtime-assets.ts');const calls=[];
 await prepareTextAssets({role:'text-lfm3',downloads:false,verifyOnly:true,hasLocalFiles:false,ensureRuntime:async()=>{calls.push('runtime');},prepare:async()=>{throw Error('unexpected prepare');},verify:async()=>{calls.push('verified');}});
 assert.deepEqual(calls,['verified']);
});
