import {createStreamingSHA256,streamingSHA256Backend} from '../dist/streaming-sha256.js';
import {hashLocalModel} from '../dist/local-models.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createRuntimeModuleCache} from '../dist/runtime-module.js';

test('a failed load releases resources acquired before the failure before reporting its error',async()=>{
 const source=(await readFile(new URL('../dist/model-worker.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
 const events=[],calls=[],context=vm.createContext({createStreamingSHA256,streamingSHA256Backend,fetch:()=>{throw Error('No network');},postMessage:m=>events.push(m),AbortController,DOMException,performance,console});
 vm.runInContext(source+'\nglobalThis.installFailingLoad=(dispose)=>{load=async()=>{model={dispose};throw Error("Session creation failed");};};globalThis.ownership=()=>({session,model,loadedModelInfo});',context);
 context.installFailingLoad(async()=>{calls.push('model disposed');});
 await context.onmessage({data:{id:1,cmd:'load',args:{model:'9B'}}});
 assert.deepEqual(calls,['model disposed']);assert.equal(events.at(-1).type,'error');assert.match(events.at(-1).value,/Session creation failed/);
 for(const value of Object.values(context.ownership()))assert.ok(value==null);
});

test('cleanup failures release both session and model ownership and allow an explicit retry',async()=>{
 const source=(await readFile(new URL('../dist/model-worker.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
 for(const fail of ['session','model','both']){
  const events=[],calls=[],context=vm.createContext({createStreamingSHA256,streamingSHA256Backend,fetch:()=>{throw Error('No network');},postMessage:m=>events.push(m),AbortController,DOMException,performance,console});
  vm.runInContext(source+'\nglobalThis.install=(s,m)=>{session=s;model=m;loadedModelInfo={model:"9B"};};globalThis.ownership=()=>({session,model,loadedModelInfo});',context);
  const disposal=name=>async()=>{calls.push(name);if(fail===name||fail==='both')throw Error(name+' release failed');};
  context.install({dispose:disposal('session')},{dispose:disposal('model')});
  await context.onmessage({data:{id:1,cmd:'unload'}});
  assert.deepEqual(calls,['session','model'],fail+' must attempt both releases');
  for(const value of Object.values(context.ownership()))assert.equal(value,null);
  assert.equal(events.at(-1).type,'error');assert.match(events.at(-1).value,fail==='both'?/cleanup failed/:/release failed/);
  await context.onmessage({data:{id:2,cmd:'count',args:{messages:[]}}});assert.equal(events.at(-1).type,'error');assert.match(events.at(-1).value,/not loaded/);
  await context.onmessage({data:{id:3,cmd:'unload'}});assert.equal(events.at(-1).type,'done');assert.deepEqual(calls,['session','model'],'retry cannot dispose detached resources twice');
 }
});

test('explicit diagnostic reset isolates a generation and reports runtime completion metadata',async()=>{
 const source=(await readFile(new URL('../dist/model-worker.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
 const events=[];let resets=0;
 const stream={async *[Symbol.asyncIterator](){yield {type:'text',text:'actual worker fixture'};},result:Promise.resolve({finish_reason:'stop',usage:{prompt_tokens:12,cached_tokens:0,completion_tokens:3},timings:{ttft_ms:1,decode_ms:5,tokens_per_second:400}})};
 const context=vm.createContext({createStreamingSHA256,streamingSHA256Backend,fetch:()=>{},postMessage:m=>events.push(m),AbortController,DOMException,performance,console});
 vm.runInContext(source+'\nglobalThis.setTestSession=(s)=>{session=s;model={contextLength:2048};};',context);
 context.setTestSession({reset:()=>{resets++;},count_tokens:()=>({prompt_tokens:12}),generate:()=>stream});
 await context.onmessage({data:{id:1,cmd:'generate',args:{messages:[],maxTokens:32,resetSession:true}}});
 assert.equal(resets,1);const result=events.find(e=>e.id===1&&e.type==='done').value;
 assert.equal(result.finishReason,'stop');assert.equal(result.usage.cached_tokens,0);
 assert.equal(result.metrics.outputTokens,3);assert.ok(result.metrics.generationTokensPerSecond>0);assert.equal(result.metrics.decodePipelineDepth,1);assert.equal(result.metrics.memoryAfter,null);
 assert.equal(result.metrics.runtimeTtftMs,1);assert.equal(result.metrics.runtimeDecodeMs,5);assert.equal(result.metrics.runtimeDecodeTokensPerSecond,400);
 await context.onmessage({data:{id:2,cmd:'generate',args:{messages:[],maxTokens:32}}});
 assert.equal(resets,1,'ordinary generation keeps the existing session behavior');
});

test('diagnostic non-thinking sampling is explicit and never changes the default greedy profile',async()=>{
 const source=(await readFile(new URL('../dist/model-worker.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
 const events=[],options=[];
 const context=vm.createContext({createStreamingSHA256,streamingSHA256Backend,fetch:()=>{},postMessage:m=>events.push(m),AbortController,DOMException,performance,console});
 vm.runInContext(source+'\nglobalThis.setTestSession=(s)=>{session=s;model={contextLength:2048};};',context);
 context.setTestSession({reset:()=>{},count_tokens:()=>({prompt_tokens:12}),generate:(_messages,o)=>{options.push(o);return {async *[Symbol.asyncIterator](){yield {type:'text',text:'fixture'};},result:Promise.resolve({finish_reason:'stop'})};}});
 await context.onmessage({data:{id:1,cmd:'generate',args:{messages:[],maxTokens:32,profile:'bonsai-nonthinking',seed:19}}});
 assert.equal(options[0].do_sample,true);assert.equal(options[0].temperature,.7);assert.equal(options[0].top_p,.8);assert.equal(options[0].top_k,20);assert.equal(options[0].seed,19);
 await context.onmessage({data:{id:2,cmd:'generate',args:{messages:[],maxTokens:32}}});assert.equal(options[1].do_sample,false);
 await context.onmessage({data:{id:3,cmd:'generate',args:{messages:[],maxTokens:32,profile:'arbitrary'}}});assert.match(events.at(-1).value,/profile/);
 await context.onmessage({data:{id:4,cmd:'generate',args:{messages:[],maxTokens:32,decodePipelineDepth:4}}});assert.equal(options[2].decode_pipeline_depth,4);assert.equal(events.at(-1).value.metrics.outputTokens,null,'text chunks must not become a fabricated token count');
 await context.onmessage({data:{id:5,cmd:'generate',args:{messages:[],maxTokens:32,decodePipelineDepth:2}}});assert.match(events.at(-1).value,/pipeline/);
});

test('stopping verification of an existing cached asset cannot open a replacement writer or remove that asset',async()=>{
 const source=(await readFile(new URL('../dist/model-worker.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');const {SHA256}=await import('../dist/sha256.js');let writes=0,removed=0,fetches=0,cancelled=0,released=0;const abort=new AbortController(),asset={name:'runtime.js',bytes:3,sha256:'a'.repeat(64),url:'https://invalid.example/never-fetch'};
 const file={size:3,stream:()=>({getReader:()=>({read:async()=>{abort.abort(new DOMException('Stopped','AbortError'));return {done:false,value:new Uint8Array([1,2,3])};},cancel:async()=>{cancelled++;},releaseLock:()=>{released++;}})})};const root={getFileHandle:async()=>({createWritable:async()=>{writes++;throw Error('replacement writer opened');}}),removeEntry:async()=>{removed++;}};
 const context=vm.createContext({createStreamingSHA256,streamingSHA256Backend,SHA256,hashLocalModel,fetch:()=>{fetches++;throw Error('unexpected fetch');},postMessage:()=>{},AbortController,DOMException,performance,console});vm.runInContext(source+'\nglobalThis.testStore=(asset,f,dir,signal)=>{file=async()=>f;root=dir;controller=signal;return storeAsset(asset,1);};',context);
 await assert.rejects(context.testStore(asset,file,root,abort),/Stopped/);assert.equal(writes,0);assert.equal(removed,0);assert.equal(fetches,0);assert.equal(cancelled,1);assert.equal(released,1);
});

test('cached worker verification delivers queued Stop without replacing retained bytes',async()=>{
 const source=(await readFile(new URL('../dist/model-worker.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');const events=[];let writes=0,removes=0,reads=0,cancelled=0,released=0;
 const abort=new AbortController(),chunk=new Uint8Array(65536),file={size:32*1024*1024,stream:()=>({getReader:()=>({async read(){return ++reads<=512?{value:chunk,done:false}:{done:true};},async cancel(){cancelled++;},releaseLock(){released++;}})})};
 const dir={getFileHandle:async()=>({createWritable:async()=>{writes++;throw Error('unexpected writer');}}),removeEntry:async()=>{removes++;}};
 const context=vm.createContext({createStreamingSHA256,streamingSHA256Backend,hashLocalModel,fetch:()=>{throw Error('unexpected network');},postMessage:e=>events.push(e),AbortController,DOMException,performance,console});
 vm.runInContext(source+'\nglobalThis.verifyCache=(f,dir,c)=>{file=async()=>f;root=dir;controller=c;return storeAsset({name:"weights",bytes:f.size,sha256:"a".repeat(64)},1);};',context);
 const timer=setTimeout(()=>abort.abort(new DOMException('Stopped','AbortError')),0);
 try{await assert.rejects(context.verifyCache(file,dir,abort),/Stopped/);assert.ok(reads<512);assert.equal(writes,0);assert.equal(removes,0);assert.equal(cancelled,1);assert.equal(released,1);}finally{clearTimeout(timer);}
});

test('Stop cancels pending asset copy and aborts writer without accepting readiness',async()=>{
 const source=(await readFile(new URL('../dist/model-worker.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');const {SHA256}=await import('../dist/sha256.js');let settle,cancelled=0,released=0,aborted=0,closed=0,removed=0;
 const controller=new AbortController(),local={size:3,stream:()=>({getReader:()=>({read:()=>new Promise(resolve=>{settle=resolve;}),async cancel(){cancelled++;settle?.({done:true});},releaseLock(){released++;}})})};
 const writer={async write(){throw Error('must not write');},async close(){closed++;},async abort(){aborted++;}},dir={getFileHandle:async()=>({createWritable:async()=>writer}),async removeEntry(){removed++;}};
 const context=vm.createContext({createStreamingSHA256,streamingSHA256Backend,SHA256,fetch:()=>{throw Error('unexpected fetch');},postMessage:()=>{},AbortController,DOMException,performance,console});
 vm.runInContext(source+'\nglobalThis.copy=(f,d,c)=>{file=async()=>{throw Error("absent");};root=d;controller=c;return storeAsset({name:"weights",bytes:3,sha256:"a".repeat(64)},1,f);};',context);
 const pending=context.copy(local,dir,controller);for(let i=0;i<10&&!settle;i++)await new Promise(resolve=>setTimeout(resolve,0));assert.ok(settle);controller.abort(new DOMException('Stopped','AbortError'));
 await assert.rejects(pending,/Stopped/);assert.equal(cancelled,1);assert.equal(released,1);assert.equal(aborted,1);assert.equal(closed,0);assert.equal(removed,1);
});


test('stored text verification hashes without loading, writing or fetching and rejects same-size corruption',async()=>{
 const source=(await readFile(new URL('../dist/model-worker.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
 const {createHash}=await import('node:crypto');const sha=s=>createHash('sha256').update(s).digest('hex');
 const events=[],bytes=new Map([[sha('model'),new Blob(['model'])],[sha('runtime'),new Blob(['runtime'])]]);let network=0;
 const context=vm.createContext({createStreamingSHA256,streamingSHA256Backend,fetch:()=>{network++;throw Error('Forbidden network');},postMessage:m=>events.push(m),AbortController,DOMException,hashLocalModel,console});
 vm.runInContext(source+'\nglobalThis.setup=(m,read)=>{manifest=m;file=read;};',context);
 context.setup({models:[{id:'4B',file:{bytes:5,sha256:sha('model')}}],runtime:{file:{bytes:7,sha256:sha('runtime')}}},async key=>{if(!bytes.has(key))throw Error('Missing local asset');return bytes.get(key);});
 await context.onmessage({data:{id:1,cmd:'verify',args:{model:'4B',allowNetwork:true}}});assert.equal(events.at(-1).type,'done');assert.equal(network,0);
 bytes.set(sha('model'),new Blob(['wrong']));await context.onmessage({data:{id:2,cmd:'verify',args:{model:'4B'}}});assert.equal(events.at(-1).type,'error');assert.match(events.at(-1).value,/verification/);assert.equal(network,0);
 bytes.delete(sha('model'));await context.onmessage({data:{id:3,cmd:'verify',args:{model:'4B'}}});assert.equal(events.at(-1).type,'error');assert.equal(network,0);
});

test('actual worker Load reuses verified code but recreates models/sessions and ignores old device-loss completion',async()=>{
 const source=(await readFile(new URL('../dist/model-worker.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
 const {createHash}=await import('node:crypto'),runtimeFile=new Blob(['controlled runtime']),pin={revision:'a'.repeat(40),file:{bytes:runtimeFile.size,sha256:createHash('sha256').update('controlled runtime').digest('hex')}};
 let imports=0,verifies=0,disposedModels=0,disposedSessions=0;const models=[];
 const api={Qwen3_5ForConditionalGeneration:{async from_pretrained(){let lose;const model={contextLength:512,deviceInfo:()=>({}),memoryStats:()=>({}),create_session(){return{async dispose(){disposedSessions++;}};},async dispose(){disposedModels++;},lost:new Promise(resolve=>lose=resolve),lose};model.lose=lose;models.push(model);return model;}}};
 const moduleCache=createRuntimeModuleCache({createURL:()=> 'blob:controlled',revokeURL(){},importModule:async()=>{imports++;return api;}}),context=vm.createContext({streamingSHA256Backend,createRuntimeModuleCache:()=>moduleCache,fetch:()=>{throw Error('No network');},postMessage(){},AbortController,DOMException,performance,URL,console,self:{location:{href:'https://qa.invalid/worker.js'}}});
 vm.runInContext(source+'\nglobalThis.install=(runtime,verify)=>{manifest={runtime,contextTokens:512,models:[{id:"2B",revision:"model",format:"PTQ1_0",file:{name:"model.gguf"}}]};meta=async()=>({});verifyStored=verify;controller=new AbortController();};globalThis.loadActual=()=>load(1,"2B");globalThis.currentModel=()=>model;',context);
 context.install(pin,async()=>{verifies++;return{f:new Blob(['weights']),runtime:runtimeFile};});
 assert.equal((await context.loadActual()).timings.runtimeModuleReused,false);assert.equal((await context.loadActual()).timings.runtimeModuleReused,true);
 assert.equal(imports,1);assert.equal(verifies,2);assert.equal(models.length,2);assert.equal(disposedModels,1);assert.equal(disposedSessions,1);
 models[0].lose(Error('old controlled device loss'));await Promise.resolve();assert.equal(context.currentModel(),models[1]);
});
