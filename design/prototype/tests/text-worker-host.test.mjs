import test from 'node:test';import assert from 'node:assert/strict';
import {createTextWorkerHost} from '../src/text-worker-host.ts';
import {createIsolatedTextClient} from '../src/isolated-text-client.ts';
import {PlannerOutputError} from '../src/planner-error.ts';
const message=(id,cmd,args={})=>({data:{id,cmd,args}});
test('worker initialization passes validated app-owned model declarations into its runtime factory',async()=>{let configuration;const out=[],host=createTextWorkerHost(async(_progress,value)=>{configuration=value;return {assets:{}};},m=>out.push(m));await host(message(1,'init',{customModels:[{id:'local-model'}]}));assert.deepEqual(configuration,{customModels:[{id:'local-model'}]});assert.equal(out.at(-1).type,'done');});
test('load timing survives the worker protocol and isolated client boundary',async()=>{const worker={postMessage(m){void host({data:m});},terminate(){}},client=createIsolatedTextClient(worker),metrics={verificationMs:12,runtimeLoadMs:340,totalLoadMs:352};const host=createTextWorkerHost(async()=>({assets:{local:{filesPresent:true}},load:async()=>metrics}),m=>worker.onmessage({data:m}));await client.init();assert.deepEqual(await client.load('local'),metrics);assert.equal(client.loaded,'local');client.abort();});
test('prepared worker protocol refuses acquisition before runtime creation and serializes actual commands',async()=>{const out=[];let starts=0,release;const runtime={assets:{local:{filesPresent:true}},count:()=>new Promise(r=>release=r),generate:async()=>({text:'controlled'}),load:async()=>{},unload:async()=>{}};const host=createTextWorkerHost(async()=>{starts++;return runtime;},m=>out.push(m));await host(message(1,'prepare'));assert.equal(starts,0);assert.match(out.pop().value,/Unknown/);await host(message(2,'status'));assert.equal(out.pop().value.local.filesPresent,true);const pending=host(message(3,'count',{messages:[]}));await Promise.resolve();await Promise.resolve();await host(message(4,'load',{model:'local'}));assert.match(out.pop().value,/busy/);release({prompt_tokens:12});await pending;assert.equal(out.pop().value.prompt_tokens,12);assert.equal(starts,1);});
test('worker diagnostics stay bounded and survive the generic isolated client',async()=>{const worker={postMessage(m){void host({data:m});},terminate(){}},client=createIsolatedTextClient(worker);const host=createTextWorkerHost(async()=>({generate:async()=>{throw new PlannerOutputError('Invalid model JSON','x'.repeat(9000),'structured:incomplete');}}),m=>worker.onmessage({data:m}));await assert.rejects(client.call('generate',{messages:[]}),e=>e.diagnostic.raw.length<=8192&&e.diagnostic.reason==='structured:incomplete');client.abort();await assert.rejects(client.call('status'),/Stopped/);});

test('startup failure is retained as failure and only a new explicit request retries initialization',async()=>{let starts=0;const out=[],host=createTextWorkerHost(async progress=>{starts++;if(starts===1)throw Error('Local assets unavailable');progress('Checking local files');return {assets:{local:{filesPresent:true}}};},m=>out.push(m));await host(message(1,'status'));assert.match(out.pop().value,/unavailable/);assert.equal(starts,1);await host(message(2,'status'));assert.equal(starts,2);assert.equal(out[0].type,'progress');assert.equal(out.at(-1).type,'done');});

test('Stop rejects immediately but disposes nested workers before outer termination',async()=>{const sent=[],worker={postMessage(m){sent.push(m);},terminate(){sent.push('terminated');}},client=createIsolatedTextClient(worker,{disposeHandshake:true});const pending=client.call('generate',{messages:[]});client.abort();await assert.rejects(pending,/Stopped/);assert.equal(sent.at(-1).cmd,'dispose');client.worker.terminate();assert.equal(sent.includes('terminated'),false);worker.onmessage({data:{id:0,type:'disposed'}});assert.equal(sent.at(-1),'terminated');});
test('isolated client exposes completion only after disposal acknowledgement and termination',async()=>{
 const sent=[],worker={postMessage(m){sent.push(m);},terminate(){sent.push('terminated');}},client=createIsolatedTextClient(worker,{disposeHandshake:true});
 let done=false;const disposal=client.abort();assert.ok(disposal instanceof Promise);disposal.then(()=>done=true);
 await Promise.resolve();assert.equal(done,false);assert.equal(sent.at(-1).cmd,'dispose');
 worker.onmessage({data:{id:0,type:'disposed'}});await disposal;assert.equal(done,true);assert.equal(sent.at(-1),'terminated');
});
test('failed child cleanup cannot report a confirmed disposal',async()=>{
 const worker={postMessage(){},terminate(){}},client=createIsolatedTextClient(worker,{disposeHandshake:true});
 const disposal=client.abort();worker.onmessage({data:{id:0,type:'disposed',cleanupFailed:true}});
 await assert.rejects(disposal,/cleanup not confirmed/i);
});
test('worker disposal reaches child cleanup while inference is pending',async()=>{const out=[];let release,stops=0,children=0;const host=createTextWorkerHost(async()=>({generate:()=>new Promise(r=>release=r),stop(){stops++;}}),m=>out.push(m),()=>children++);const pending=host(message(1,'generate',{messages:[]}));await new Promise(r=>setImmediate(r));await host(message(0,'dispose'));assert.equal(stops,1);assert.equal(children,1);assert.equal(out.at(-1).type,'disposed');release({text:'late'});await pending;assert.equal(out.at(-1).type,'error');assert.equal(out.at(-1).value,'Stopped');});

test('a failing model stop still disposes children and acknowledges disposal',async()=>{
 const out=[];let release,children=0;const host=createTextWorkerHost(async()=>({generate:()=>new Promise(r=>release=r),stop(){throw Error('Stop failed');}}),m=>out.push(m),()=>children++);
 const pending=host(message(1,'generate',{messages:[]}));await new Promise(r=>setImmediate(r));
 await host(message(0,'dispose'));assert.equal(children,1);assert.equal(out.at(-1).type,'disposed');release({text:'late'});await pending;assert.equal(out.at(-1).value,'Stopped');
});

test('stop during runtime initialization cannot start an obsolete model load',async()=>{
 const out=[];let release,started,loads=0,disposals=0;
 const initialized=new Promise(resolve=>{started=resolve;});
 const host=createTextWorkerHost(async()=>{started();return await new Promise(resolve=>{release=resolve;});},m=>out.push(m),()=>disposals++);
 const pending=host(message(1,'load',{model:'old'}));await initialized;
 await host(message(0,'dispose'));assert.equal(disposals,1);assert.equal(out.at(-1).type,'disposed');
 release({load:async()=>{loads++;return {};},stop(){}});await pending;
 assert.equal(loads,0);assert.deepEqual(out.at(-1),{id:1,type:'error',value:'Stopped'});
 await host(message(2,'load',{model:'new'}));assert.deepEqual(out.at(-1),{id:2,type:'error',value:'Stopped'});
});

import {ownChildWorkers} from '../src/owned-workers.ts';
test('dedicated scope owns every engine child and refuses creation after disposal',()=>{let ended=0;const scope={Worker:class {terminate(){ended++;}}},owned=ownChildWorkers(scope);const first=new scope.Worker('one');new scope.Worker('two');assert.equal(owned.size,2);first.terminate();assert.equal(owned.size,1);owned.dispose();assert.equal(owned.size,0);assert.equal(ended,2);assert.throws(()=>new scope.Worker('late'),/Stopped/);});

test('child cleanup continues when one worker termination fails',()=>{
 const ended=[],scope={Worker:class {constructor(url){this.url=url;}terminate(){ended.push(this.url);if(this.url==='one')throw Error('Termination failed');}}},owned=ownChildWorkers(scope);
 new scope.Worker('one');new scope.Worker('two');assert.throws(()=>owned.dispose(),/Termination failed/);
 assert.deepEqual(ended,['one','two']);assert.equal(owned.size,0);assert.throws(()=>new scope.Worker('late'),/Stopped/);
});

test('partial answer reaches the client before completion and late stopped events are ignored',async()=>{
 let publish,finish;const events=[],worker={postMessage(m){void host({data:m});},terminate(){}};
 const client=createIsolatedTextClient(worker),host=createTextWorkerHost(async()=>({generate:async(_messages,_tokens,_format,onPreview)=>{publish=onPreview;await new Promise(r=>finish=r);return {text:'final'};},stop(){}}),m=>worker.onmessage({data:m}));
 const pending=client.call('generate',{messages:[]},(type,text)=>events.push({type,text}));await new Promise(r=>setImmediate(r));
 publish('日本');assert.deepEqual(events,[{type:'answer-preview',text:'日本'}]);
 client.abort();await assert.rejects(pending,/Stopped/);publish('late');finish();await new Promise(r=>setImmediate(r));assert.equal(events.length,1);
});
