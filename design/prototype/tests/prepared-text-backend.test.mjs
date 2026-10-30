import test from 'node:test';import assert from 'node:assert/strict';
import {createPreparedTextBackend} from '../src/prepared-text-backend.ts';
import {TextEngineRouter} from '../src/text-engine-router.ts';
import {createIsolatedTextClient} from '../src/isolated-text-client.ts';
test('router Stop awaits the actual isolated client disposal handshake',async()=>{
 const sent=[],worker={postMessage(message){sent.push(message);if(message.id>0)queueMicrotask(()=>worker.onmessage({data:{id:message.id,type:'done',value:{}}}));},terminate(){sent.push('terminated');}};
 const manifest={contextTokens:2048,runtime:{revision:'runtime'},models:[{id:'local',revision:'model'}]},store={async status(){return {filesPresent:true};},async verify(){},async prepare(){}};
 const base={manifest:{contextTokens:2048,runtime:{revision:'base'},models:[]},loaded:null,abort(){},worker:{terminate(){}},async init(){},async call(){return{};},async load(){},async unload(){}};
 const router=new TextEngineRouter(base,()=>{throw Error('unused');},[{id:'local-engine',modelIds:['local'],describe:()=>manifest,create:()=>createPreparedTextBackend({manifest,stores:new Map([['local',store]]),createClient:()=>createIsolatedTextClient(worker,{disposeHandshake:true})})}]);
 await router.load('local');let complete=false;const disposal=router.abort().then(()=>complete=true);
 await Promise.resolve();assert.equal(complete,false);assert.equal(sent.at(-1).cmd,'dispose');
 worker.onmessage({data:{id:0,type:'disposed'}});await disposal;assert.equal(complete,true);assert.equal(sent.at(-1),'terminated');
});
test('failed load waits for client disposal before returning its original error',async()=>{
 let finish,aborting;const disposal=new Promise(resolve=>{finish=resolve;}),started=new Promise(resolve=>{aborting=resolve;}),failure=Error('Load failed');
 const store={async status(){return {filesPresent:true};},async verify(){},async prepare(){}},client={loaded:null,worker:{terminate(){}},async init(){},async load(){throw failure;},async unload(){},async call(){},abort(){aborting();return disposal;}};
 const backend=createPreparedTextBackend({manifest:{models:[{id:'local'}]},stores:new Map([['local',store]]),createClient:()=>client});
 let settled=false;const pending=backend.load('local').catch(error=>{settled=true;return error;});await started;await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);
 finish();assert.equal(await pending,failure);
});
test('failed load identifies unconfirmed cleanup instead of reporting a safe release',async()=>{
 const store={async status(){return {filesPresent:true};},async verify(){},async prepare(){}},client={loaded:null,worker:{terminate(){}},async init(){},async load(){throw Error('Load failed');},async unload(){},async call(){},async abort(){throw Error('Disposal failed');}};
 const backend=createPreparedTextBackend({manifest:{models:[{id:'local'}]},stores:new Map([['local',store]]),createClient:()=>client});
 await assert.rejects(backend.load('local'),error=>error.cleanupUnconfirmed===true&&/cleanup not confirmed/i.test(error.message));
});
test('failed unload waits for client disposal before returning its original error',async()=>{
 let finish,aborting;const disposal=new Promise(resolve=>{finish=resolve;}),started=new Promise(resolve=>{aborting=resolve;}),failure=Error('Unload failed');
 const store={async status(){return {filesPresent:true};},async verify(){},async prepare(){}},client={loaded:null,worker:{terminate(){}},async init(){},async load(id){this.loaded=id;},async unload(){throw failure;},async call(){},abort(){aborting();return disposal;}};
 const backend=createPreparedTextBackend({manifest:{models:[{id:'local'}]},stores:new Map([['local',store]]),createClient:()=>client});await backend.load('local');
 let settled=false;const pending=backend.unload().catch(error=>{settled=true;return error;});await started;await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);
 finish();assert.equal(await pending,failure);
});
test('failed unload identifies unconfirmed cleanup',async()=>{
 const store={async status(){return {filesPresent:true};},async verify(){},async prepare(){}},client={loaded:null,worker:{terminate(){}},async init(){},async load(id){this.loaded=id;},async unload(){throw Error('Unload failed');},async call(){},async abort(){throw Error('Disposal failed');}};
 const backend=createPreparedTextBackend({manifest:{models:[{id:'local'}]},stores:new Map([['local',store]]),createClient:()=>client});await backend.load('local');
 await assert.rejects(backend.unload(),error=>error.cleanupUnconfirmed===true&&/cleanup not confirmed/i.test(error.message));
});
function setup(){const calls=[];let starts=0,release;const loadMetrics={verificationMs:12,runtimeLoadMs:340,totalLoadMs:352};const store={async status(){return{filesPresent:true};},async verify(signal){calls.push('verify');if(release)await release;signal.throwIfAborted();},async prepare(network,signal,_progress,files){calls.push({network,files});signal.throwIfAborted();}};const client={failed:false,loaded:null,worker:{terminate(){}},async init(){calls.push('init');},async load(id){calls.push('load');this.loaded=id;return loadMetrics;},async unload(){this.loaded=null;},async call(cmd){calls.push(cmd);return cmd;},abort(){this.failed=true;this.loaded=null;calls.push('abort');}};const backend=createPreparedTextBackend({manifest:{models:[{id:'local'}]},stores:new Map([['local',store]]),createClient(){starts++;return client;}});return{backend,calls,client,loadMetrics,get starts(){return starts;},hold(p){release=p;}};}
test('status and explicit asset operations do not create inference workers',async()=>{const f=setup();assert.equal((await f.backend.init()).local.filesPresent,true);await f.backend.call('verify',{model:'local'});await f.backend.call('prepare',{model:'local',localFiles:['controlled-file']});assert.equal(f.starts,0);assert.deepEqual(f.calls,['verify',{network:false,files:['controlled-file']}]);await assert.rejects(f.backend.call('prepare',{model:'unknown'}),/Unknown/);assert.equal(f.starts,0);});
test('a failed model status does not hide other models in the same engine',async()=>{
 const good={status:async()=>({filesPresent:true})},bad={status:async()=>{throw new DOMException('Denied','NotAllowedError');}};
 const backend=createPreparedTextBackend({manifest:{models:[{id:'bad'},{id:'good'}]},stores:new Map([['bad',bad],['good',good]]),createClient:()=>{throw Error('Unexpected inference worker');}});
 const status=await backend.init();assert.deepEqual(status.bad,{filesPresent:false,presenceOnly:true,statusError:true});assert.deepEqual(status.good,{filesPresent:true,presenceOnly:true});
});
test('stopping a status check still rejects rather than publishing an error status',async()=>{
 let release;const store={status:()=>new Promise((_,reject)=>{release=()=>reject(Error('Cancelled'));})};
 const backend=createPreparedTextBackend({manifest:{models:[{id:'model'}]},stores:new Map([['model',store]]),createClient:()=>{throw Error('Unexpected inference worker');}});
 const pending=backend.init();await Promise.resolve();backend.abort();release();await assert.rejects(pending,/Stopped/);
});
test('Load creates the prepared client, returns bounded load metrics, and keeps acquisition separate',async()=>{const f=setup();await assert.rejects(f.backend.call('count'),/not loaded/);const metrics=await f.backend.load('local');assert.equal(metrics.importMs>=0,true);assert.deepEqual({...metrics,importMs:undefined},{...f.loadMetrics,importMs:undefined});assert.equal(f.starts,1);assert.equal(f.backend.loaded,'local');await f.backend.call('count');await f.backend.call('verify',{model:'local'});assert.deepEqual(f.calls,['init','load','count','verify']);await f.backend.unload();assert.equal(f.backend.loaded,null);});
test('repair after unload disposes the old file snapshot before the next load',async()=>{
 const clients=[],store={async status(){return {filesPresent:true};},async verify(){},async prepare(){}};
 const backend=createPreparedTextBackend({manifest:{models:[{id:'local'}]},stores:new Map([['local',store]]),createClient(){const c={loaded:null,failed:false,async init(){},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){this.failed=true;},worker:{terminate(){}}};clients.push(c);return c;}});
 await backend.load('local');await backend.unload();await backend.call('prepare',{model:'local',localFiles:['replacement']});
 assert.equal(clients[0].failed,true);await backend.load('local');assert.equal(clients.length,2);assert.equal(backend.loaded,'local');
});

test('repair waits for unloaded worker disposal and reports unconfirmed cleanup',async()=>{
 let rejectDisposal;const store={async status(){return{};},async verify(){},async prepare(){}};
 const client={loaded:null,worker:{terminate(){}},async init(){},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){return new Promise((_,reject)=>{rejectDisposal=reject;});}};
 const backend=createPreparedTextBackend({manifest:{models:[{id:'local'}]},stores:new Map([['local',store]]),createClient:()=>client});
 await backend.load('local');await backend.unload();let settled=false;const pending=backend.call('prepare',{model:'local'}).finally(()=>{settled=true;});await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);
 rejectDisposal(Error('disposal failed'));await assert.rejects(pending,error=>error.cleanupUnconfirmed===true);await assert.rejects(backend.load('local'),/Stopped|cleanup/i);
});
test('router blocks model load after repair cannot confirm worker disposal',async()=>{
 const manifest={contextTokens:2048,runtime:{revision:'test'},models:[{id:'local',revision:'one'}]},store={async status(){return{};},async verify(){},async prepare(){}};let starts=0;
 const base={manifest:{contextTokens:2048,runtime:{revision:'base'},models:[]},worker:{terminate(){}},abort(){},async init(){},async call(){return{};},async load(){},async unload(){}};
 const router=new TextEngineRouter(base,()=>{throw Error('unused');},[{id:'local-engine',modelIds:['local'],describe:()=>manifest,create:()=>createPreparedTextBackend({manifest,stores:new Map([['local',store]]),createClient:()=>{starts++;return {loaded:null,worker:{terminate(){}},async init(){},async load(id){this.loaded=id;},async unload(){this.loaded=null;},async abort(){throw Error('disposal failed');}};}})}]);
 await router.load('local');await router.unload();await assert.rejects(router.call('prepare',{model:'local'}),error=>error.cleanupUnconfirmed===true);await assert.rejects(router.load('local'),/cleanup not confirmed/i);assert.equal(starts,1);
});
test('a failed repair also disposes an unloaded worker snapshot without hiding the error',async()=>{
 const store={async status(){return {filesPresent:true};},async verify(){},async prepare(){throw Error('Repair failed');}},clients=[];
 const backend=createPreparedTextBackend({manifest:{models:[{id:'local'}]},stores:new Map([['local',store]]),createClient(){const c={loaded:null,async init(){},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){this.aborted=true;},worker:{terminate(){}}};clients.push(c);return c;}});
 await backend.load('local');await backend.unload();await assert.rejects(backend.call('prepare',{model:'local'}),/Repair failed/);assert.equal(clients[0].aborted,true);await backend.load('local');assert.equal(clients.length,2);
});
test('preparing a second model in the same engine does not evict an active model',async()=>{
 const calls=[],store={async status(){return {filesPresent:true};},async verify(){},async prepare(){calls.push('prepare');}};
 const client={loaded:null,async init(){},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){calls.push('abort');},worker:{terminate(){}}};
 const backend=createPreparedTextBackend({manifest:{models:[{id:'first'},{id:'second'}]},stores:new Map([['first',store],['second',store]]),createClient:()=>client});
 await backend.load('first');await assert.rejects(backend.call('prepare',{model:'second'}),/Unload model first/);assert.equal(backend.loaded,'first');assert.deepEqual(calls,[]);
});
test('stopping a repair releases its old worker once and cannot start a new one',async()=>{
 let proceed,started,aborts=0,starts=0;const ready=new Promise(resolve=>{started=resolve;});
 const store={async status(){return {filesPresent:true};},async verify(){},async prepare(_network,signal){started();await new Promise(resolve=>{proceed=resolve;});signal.throwIfAborted();}};
 const backend=createPreparedTextBackend({manifest:{models:[{id:'local'}]},stores:new Map([['local',store]]),createClient(){starts++;return {loaded:null,async init(){},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){aborts++;},worker:{terminate(){}}};}});
 await backend.load('local');await backend.unload();const repair=backend.call('prepare',{model:'local'});await ready;backend.abort();proceed();await assert.rejects(repair,/Stopped/);assert.equal(aborts,1);assert.equal(starts,1);await assert.rejects(backend.load('local'),/Stopped/);
});
test('Stop cancels an asset operation and stale continuation cannot load',async()=>{const f=setup();let release;f.hold(new Promise(r=>release=r));const pending=f.backend.call('verify',{model:'local'});await Promise.resolve();f.backend.abort();release();await assert.rejects(pending,/Stopped/);assert.equal(f.starts,0);});
test('Stop while an inference client initializes prevents a late model load and releases the client',async()=>{
 let release,started,loads=0,aborts=0;const starting=new Promise(resolve=>{started=resolve;});
 const store={async status(){return {filesPresent:true};},async verify(){},async prepare(){}};
 const client={loaded:null,failed:false,async init(){started();await new Promise(resolve=>{release=resolve;});},async load(){loads++;},abort(){aborts++;this.failed=true;}};
 const backend=createPreparedTextBackend({manifest:{models:[{id:'local'}]},stores:new Map([['local',store]]),createClient:()=>client});
 const pending=backend.load('local');await starting;backend.abort();release();
 await assert.rejects(pending,/Stopped/);assert.equal(loads,0);assert.equal(aborts,1);assert.equal(backend.loaded,null);
 await assert.rejects(backend.load('local'),/Stopped/);
});
test('unknown models and concurrent operations fail before creating or changing a worker',async()=>{const f=setup();await assert.rejects(f.backend.load('unknown'),/Unknown/);let release;f.hold(new Promise(r=>release=r));const pending=f.backend.call('verify',{model:'local'});await assert.rejects(f.backend.load('local'),/busy/);assert.equal(f.starts,0);release();await pending;});


for(const phase of ['init','load'])test('failed '+phase+' disposes its client and only explicit retry creates a fresh one',async()=>{
 const clients=[],error=Error('Asset verification failed'),store={async status(){return{filesPresent:true};},async verify(){},async prepare(){}};
 const backend=createPreparedTextBackend({manifest:{models:[{id:'local'}]},stores:new Map([['local',store]]),createClient(){const first=clients.length===0;const client={loaded:null,failed:false,aborted:0,manifest:{},worker:{terminate(){}},async init(){if(first&&phase==='init')throw error;},async load(id){if(first&&phase==='load')throw error;this.loaded=id;},async unload(){this.loaded=null;},async call(){},abort(){this.aborted++;this.loaded=null;this.failed=true;}};clients.push(client);return client;}});
 await assert.rejects(backend.load('local'),e=>e===error);assert.equal(clients.length,1);assert.equal(clients[0].aborted,1);assert.equal(backend.loaded,null);assert.equal(backend.failed,false);
 await backend.call('prepare',{model:'local',allowNetwork:false});assert.equal(clients.length,1);await backend.load('local');assert.equal(clients.length,2);assert.equal(backend.loaded,'local');assert.equal(clients[0].aborted,1);
});

test('failed optional-engine Unload releases ownership and a later explicit router Load can recover',async()=>{
 const clients=[],error=Error('controlled runtime cleanup failure'),manifest={contextTokens:2048,runtime:{revision:'controlled'},models:[{id:'local',revision:'one'}]},store={async status(){return{filesPresent:true};},async verify(){},async prepare(){}};
 const backend=createPreparedTextBackend({manifest,stores:new Map([['local',store]]),createClient(){const first=clients.length===0;const client={manifest,loaded:null,failed:false,aborted:0,worker:{terminate(){}},async init(){},async load(id){this.loaded=id;},async unload(){if(first)throw error;this.loaded=null;},async call(){},abort(){this.aborted++;this.failed=true;this.loaded=null;}};clients.push(client);return client;}});
 const base={manifest:{contextTokens:2048,runtime:{revision:'base'},models:[{id:'4B',revision:'four'}]},loaded:null,worker:{terminate(){}},abort(){},async init(){},async call(){return{};},async load(){},async unload(){}};
 const router=new TextEngineRouter(base,()=>{throw Error('Unused ONNX factory');},[{id:'controlled-engine',modelIds:['local'],describe:()=>manifest,create:()=>backend}]);
 await router.load('local');await assert.rejects(router.unload(),e=>e===error);
 assert.equal(router.loaded,null);assert.equal(backend.loaded,null);assert.equal(clients[0].aborted,1);assert.equal(clients.length,1,'failure must not replay Load');
 await backend.call('verify',{model:'local'});assert.equal(clients.length,1,'verification must not create inference client');
 await router.load('local');assert.equal(clients.length,2);assert.equal(router.loaded,'local');assert.equal(clients[0].aborted,1);
});
