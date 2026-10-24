import test from 'node:test';import assert from 'node:assert/strict';
import {createTextInference} from '../src/text-inference.ts';
const fixture=()=>({manifest:{contextTokens:2048,models:[{id:'local',revision:'weights'}],runtime:{revision:'runtime'}},loaded:'local',assets:{local:{filesPresent:true}},load:async()=>{},stop:()=>{},count:async()=>({prompt_tokens:9}),generate:async()=>({text:'actual port output'})});
test('inference boundary delegates exact messages and exposes no download or storage authority',async()=>{const p=fixture(),messages=[{role:'user',content:'Original 日本語'}];p.generate=async(m,max)=>{assert.deepEqual(m,messages);assert.equal(max,64);return {text:'port result'};};const e=createTextInference(()=>p);assert.equal((await e.generate(messages,64)).text,'port result');assert.equal(e.prepare,undefined);assert.equal(e.save,undefined);assert.equal(e.manifest.contextTokens,2048);});
test('inference preserves completion metadata and counts with the exact output format',async()=>{const p=fixture(),messages=[{role:'user',content:'Write prose'}];let counted=[];p.count=async(m,format)=>{counted.push(format);return {prompt_tokens:9};};p.generate=async(m,budget,format)=>{assert.equal(format,'prose');return {text:'Done.',finishReason:'stop',outputTokens:3};};const e=createTextInference(()=>p);assert.deepEqual(await e.generate(messages,64,'prose'),{text:'Done.',finishReason:'stop',outputTokens:3});assert.deepEqual(counted,['prose']);});
test('inference preserves only bounded numeric runtime performance metrics, never device strings or output content',async()=>{
 const p=fixture();p.generate=async()=>({text:'Private generated answer',finishReason:'stop',outputTokens:7,metrics:{countMs:4.5,visibleTextTtftMs:120,generationMs:900,outputTokens:7,generationTokensPerSecond:7.77,runtimeDecodeTokensPerSecond:8.1,memoryBefore:{gpuBytes:1024,heapBytes:2048,secretLabel:'private'},memoryAfter:{gpuBytes:4096},device:{vendor:'private vendor'},raw:'PRIVATE_RUNTIME_PAYLOAD'}});
 const result=await createTextInference(()=>p).generate([],64);
 assert.equal(result.text,'Private generated answer');
 assert.deepEqual(result.metrics,{countMs:4.5,visibleTextTtftMs:120,generationMs:900,outputTokens:7,generationTokensPerSecond:7.77,runtimeDecodeTokensPerSecond:8.1,memoryBefore:{gpuBytes:1024,heapBytes:2048},memoryAfter:{gpuBytes:4096}});
});
test('Stop and changed model during asynchronous inference refuse late output',async()=>{const p=fixture();let release;p.generate=()=>new Promise(r=>release=r);const e=createTextInference(()=>p),pending=e.generate([]);await new Promise(r=>setImmediate(r));e.stop();release({text:'late'});await assert.rejects(pending,/Stopped/);const changed=e.generate([]);await new Promise(r=>setImmediate(r));p.loaded='other';release({text:'wrong model'});await assert.rejects(changed,/Model changed/);});
test('unprepared load and invalid runtime results fail without manufacturing output',async()=>{const p=fixture(),e=createTextInference(()=>p);let loads=0;p.load=async()=>loads++;await assert.rejects(e.load('missing'),/not prepared/);assert.equal(loads,0);p.count=async()=>({prompt_tokens:NaN});await assert.rejects(e.count([]),/token count/);p.count=async()=>({prompt_tokens:9});p.generate=async()=>({text:'partial',stopped:true});await assert.rejects(e.generate([]),/Stopped/);p.generate=async()=>({text:42});await assert.rejects(e.generate([]),/generation result/);});

test('counting uses live port state and late counts after Stop do not become budgets',async()=>{let release;const p={manifest:{contextTokens:128,models:[],runtime:{revision:'r'}},loaded:'local',assets:{},load:async()=>{},stop:()=>{},count:()=>new Promise(r=>release=r),generate:async()=>({text:''})};const e=createTextInference(()=>p),pending=e.count([]);e.stop();release({prompt_tokens:4});await assert.rejects(pending,/Stopped/);p.loaded='';await assert.rejects(e.generate([]),/not loaded/);});


test('same-ID model revision, runtime revision and context changes invalidate pending results',async()=>{
 for(const change of [p=>p.manifest.models[0].revision='new-weights',p=>p.manifest.runtime.revision='new-runtime',p=>p.manifest.contextTokens=4096]){
  for(const method of ['count','generate']){
   const p=fixture();let release;p[method]=()=>new Promise(r=>release=r);
   const e=createTextInference(()=>p),pending=e[method]([]);await new Promise(r=>setImmediate(r));change(p);
   release(method==='count'?{prompt_tokens:9}:{text:'old engine output'});
   await assert.rejects(pending,/Model changed/);
  }
 }
});
test('same-revision model asset and runtime execution-profile changes invalidate pending count and generation',async()=>{
 for(const change of [
  p=>p.manifest.models[0].files[0].sha256='replacement-weight-hash',
  p=>p.manifest.models[0].executionProfile='different-kernel',
  p=>p.manifest.runtime.integrity='replacement-runtime-hash',
 ]){
  for(const method of ['count','generate']){
   const p=fixture();p.manifest.models[0].files=[{path:'weights.gguf',sha256:'original-weight-hash'}];p.manifest.models[0].executionProfile='default';p.manifest.runtime.integrity='original-runtime-hash';
   let release;p[method]=()=>new Promise(r=>release=r);
   const pending=createTextInference(()=>p)[method]([]);await new Promise(r=>setImmediate(r));change(p);
   release(method==='count'?{prompt_tokens:9}:{text:'output from stale asset identity'});
   await assert.rejects(pending,/Model changed/);
  }
 }
});
test('equivalent live adapter replacement keeps valid results without relying on React object identity',async()=>{
 let p=fixture(),release;p.generate=()=>new Promise(r=>release=r);
 const e=createTextInference(()=>p),pending=e.generate([]);await new Promise(r=>setImmediate(r));p=fixture();release({text:'same pinned engine'});
 assert.equal((await pending).text,'same pinned engine');
});


test('one harness operation pins count and generation across model changes between calls',async()=>{
 const p=fixture(),e=createTextInference(()=>p);let generations=0;
 p.generate=async()=>{generations++;return {text:'wrong revision'};};
 const operation=e.pin?.()??e;
 assert.equal((await operation.count([])).prompt_tokens,9);
 p.manifest.models[0].revision='replacement';
 await assert.rejects(operation.generate([]),/Model changed/);
 assert.equal(generations,0);
 assert.equal((await e.generate([])).text,'wrong revision');
});
test('pinned operation cannot resume after Stop or load, while a new operation can',async()=>{
 const p=fixture(),e=createTextInference(()=>p),operation=e.pin?.()??e;
 e.stop();await assert.rejects(operation.count([]),/Stopped/);
 const next=e.pin?.()??e;await e.load('local');
 await assert.rejects(next.generate([]),/Stopped/);
 assert.equal((await e.generate([])).text,'actual port output');
});

test('nested pins retain the same operation and cannot change models',async()=>{
 const p=fixture(),e=createTextInference(()=>p),bound=e.pin();
 assert.equal(bound.pin(),bound);let loads=0;p.load=async()=>loads++;
 await assert.rejects(bound.load('local'),/Pinned inference/);assert.equal(loads,0);
 p.manifest.contextTokens=4096;assert.equal(bound.manifest.contextTokens,2048);
 await assert.rejects(bound.count([]),/Model changed/);
});

test('structured format crosses pinned inference without adding authority and late results still stop',async()=>{
 const p=fixture(),e=createTextInference(()=>p),messages=[{role:'user',content:'Hello'}];let release;
 p.generate=(received,max,format)=>{assert.deepEqual(received,messages);assert.equal(max,160);assert.equal(format,'dialogue-plan');return new Promise(r=>release=r);};
 const pending=e.pin().generate(messages,160,'dialogue-plan');await new Promise(r=>setImmediate(r));e.stop();release({text:'{"action":"chat","query":""}'});await assert.rejects(pending,/Stopped/);assert.equal(e.save,undefined);
});

test('shared generation enforces exact combined context and reuses only same-identity message counts',async()=>{
 const p=fixture();let counts=0,generations=0;p.count=async()=>{counts++;return {prompt_tokens:2000};};p.generate=async()=>{generations++;return {text:'bounded'};};
 const e=createTextInference(()=>p),messages=[{role:'user',content:'exact'}];await e.count(messages);
 await assert.rejects(e.generate(messages,49),/context limit/);assert.equal(generations,0);assert.equal(counts,1);
 await e.generate(messages,48);assert.equal(counts,1);assert.equal(generations,1);
 await e.generate([{role:'user',content:'changed'}],48);assert.equal(counts,2);
 e.stop();await e.generate(messages,48);assert.equal(counts,3);
 p.manifest.runtime.revision='changed';await e.generate(messages,48);assert.equal(counts,4);
});
test('bounded count LRU retains a planner preflight across unrelated context counts',async()=>{
 const p=fixture();let counts=0;p.count=async()=>({prompt_tokens:++counts});const e=createTextInference(()=>p),planner=[{role:'user',content:'exact scoped planner input'}];
 await e.count(planner,'dialogue-plan');await e.count([{role:'user',content:'dialogue excerpt budget'}]);await e.count([{role:'user',content:'another context budget'}]);
 await e.generate(planner,160,'dialogue-plan');assert.equal(counts,3,'the exact planner count should survive intervening context counts');
});
test('count LRU remains bounded and evicts the least recently used exact prompt',async()=>{
 const p=fixture();let counts=0;p.count=async()=>({prompt_tokens:++counts});const e=createTextInference(()=>p),prompts=Array.from({length:9},(_,index)=>[{role:'user',content:'prompt-'+index}]);
 await e.count(prompts[0]);for(const prompt of prompts.slice(1))await e.count(prompt);
 await e.generate(prompts[0],16);assert.equal(counts,10,'the oldest prompt is evicted when the entry bound is exceeded');
});
test('Stop during prerequisite count never starts generation; caller mutation cannot change counted input',async()=>{
 const p=fixture();let release,generations=0,seen;
 p.count=()=>new Promise(r=>release=r);p.generate=async messages=>{generations++;seen=messages;return {text:'exact'};};
 const e=createTextInference(()=>p),messages=[{role:'user',content:'original'}],stopped=e.generate(messages);e.stop();release({prompt_tokens:3});await assert.rejects(stopped,/Stopped/);assert.equal(generations,0);
 const pending=e.generate(messages,8);messages[0].content='modified while counting';release({prompt_tokens:3});await pending;assert.equal(seen[0].content,'original');
});
