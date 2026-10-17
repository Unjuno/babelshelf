import test from 'node:test';
import assert from 'node:assert/strict';
import {TextEngineRouter} from '../src/text-engine-router.ts';
import {onnxTextManifest} from '../src/text-model-manifest.ts';
import {createOnnxTextClient} from '../src/onnx-text-client.ts';
function setup(){const calls=[];let finish;
 const backend=name=>({manifest:{contextTokens:4096,runtime:{revision:'webml-test'},models:[{id:'4B',revision:'four'}]},loaded:null,worker:{terminate(){calls.push(name+':terminate');}},async init(){return{};},async call(cmd){calls.push(name+':'+cmd);return cmd==='status'?{[name]:{filesPresent:true}}:{};},async load(id){calls.push(name+':load');if(name==='onnx')await new Promise(r=>finish=r);this.loaded=id;},async unload(){calls.push(name+':unload');this.loaded=null;},abort(){calls.push(name+':abort');this.loaded=null;}});
 const webml=backend('webml');let onnx;
 const router=new TextEngineRouter(webml,()=>onnx=backend('onnx'));
 return {router,calls,get onnx(){return onnx;},finish:()=>finish()};
}
test('cross-engine load releases previous engine and pins active runtime identity',async()=>{
 const f=setup();await f.router.load('4B');assert.equal(f.router.manifest.runtime.revision,'webml-test');
 const pending=f.router.load(onnxTextManifest.id);await Promise.resolve();f.finish();await pending;
 assert.ok(f.calls.indexOf('webml:unload')<f.calls.indexOf('onnx:load'));
 assert.equal(f.router.loaded,onnxTextManifest.id);assert.equal(f.router.manifest.runtime.revision,onnxTextManifest.runtime.revision);
 await f.router.unload();assert.equal(f.router.loaded,null);
});
test('Stop during ONNX load discards worker and rejects late completion without replay',async()=>{
 const f=setup(),pending=f.router.load(onnxTextManifest.id);f.router.abort();f.finish();await assert.rejects(pending,/Stopped/);
 assert.equal(f.router.loaded,null);assert.ok(f.calls.includes('onnx:terminate'));assert.equal(f.calls.filter(x=>x==='onnx:load').length,1);
});
test('ONNX client Stop rejects pending work, ignores late result and requires a new client',async()=>{
 const sent=[],worker={postMessage(m){sent.push(m);},terminate(){this.terminated=true;}};
 const client=createOnnxTextClient(worker),pending=client.load(onnxTextManifest.id);client.abort();worker.onmessage({data:{id:sent[0].id,type:'done',value:true}});
 await assert.rejects(pending,/Stopped/);assert.equal(client.loaded,null);assert.equal(worker.terminated,true);await assert.rejects(client.call('status'),/Stopped/);assert.equal(sent.length,1);
});

test('Stop during optional status permits a fresh explicit configure and load',async()=>{
 const workers=[];
 const webml={manifest:{contextTokens:2048,runtime:{revision:'base'},models:[{id:'4B',revision:'four'}]},loaded:null,worker:{terminate(){}},async init(){return{};},async call(){return{};},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){}};
 const router=new TextEngineRouter(webml,()=>{const worker={postMessage(message){this.message=message;},terminate(){}};workers.push(worker);return createOnnxTextClient(worker);});
 await router.init();assert.equal(workers.length,0);
 const first=router.call('configure',{models:[]});await Promise.resolve();await Promise.resolve();assert.equal(workers.length,1);router.abort();await assert.rejects(first,/Stopped/);
 const next=router.call('configure',{models:[]});await Promise.resolve();await Promise.resolve();assert.equal(workers.length,2);
 workers[1].onmessage({data:{id:workers[1].message.id,type:'done',value:{}}});await next;await router.load('4B');assert.equal(router.loaded,'4B');
});

test('worker failure permits a fresh explicit load; old worker results cannot resurrect identity',async()=>{
 const workers=[];
 const webml={manifest:{contextTokens:2048,runtime:{revision:'base'},models:[{id:'4B',revision:'four'}]},loaded:null,worker:{terminate(){}},async init(){},async call(){return{};},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){}};
 const router=new TextEngineRouter(webml,()=>{const worker={postMessage(message){this.message=message;},terminate(){}};workers.push(worker);return createOnnxTextClient(worker);});
 const first=router.load(onnxTextManifest.id);workers[0].onmessage({data:{id:1,type:'done',value:true}});await first;workers[0].onerror();assert.equal(router.loaded,null);
 const second=router.load(onnxTextManifest.id);assert.equal(workers.length,2);workers[0].onmessage({data:{id:1,type:'done',value:true}});assert.equal(router.loaded,null);
 workers[1].onmessage({data:{id:1,type:'done',value:true}});await second;assert.equal(router.loaded,onnxTextManifest.id);workers[1].onerror();await router.load('4B');assert.equal(router.loaded,'4B');
});

import {validateOnnxTextBudget} from '../src/text-model-manifest.ts';
test('adapter accepts harness task and rewrite output budgets and rejects actual context overflow',()=>{
 validateOnnxTextBudget(1000,384);validateOnnxTextBudget(1000,768);
 assert.throws(()=>validateOnnxTextBudget(1500,768),/budget/);assert.throws(()=>validateOnnxTextBudget(0,769),/budget/);
});

test('structured worker failures retain bounded untrusted diagnostics without returning a result',async()=>{
 const sent=[],worker={postMessage(m){sent.push(m);},terminate(){}};const client=createOnnxTextClient(worker),pending=client.call('generate');
 worker.onmessage({data:{id:sent[0].id,type:'error',value:'Invalid model JSON · incomplete structured output',diagnostic:{raw:'{"action":"chat","query":"unfinished',reason:'structured:budget',truncated:false}}});
 await assert.rejects(pending,error=>error.name==='PlannerOutputError'&&error.diagnostic.reason==='structured:budget'&&error.diagnostic.raw.endsWith('unfinished'));
});

test('switching between fixed ONNX models reuses adapter but unloads old identity',async()=>{
 const f=setup(),first=f.router.load(onnxTextManifest.id);f.finish();await first;
 const second=f.router.load('qwen25-05b-instruct');await Promise.resolve();f.finish();await second;
 assert.equal(f.router.loaded,'qwen25-05b-instruct');assert.equal(f.calls.filter(x=>x==='onnx:unload').length,1);assert.equal(f.router.manifest.models.find(m=>m.id===f.router.loaded).revision,'22942cb7d7ba4cc81bb4673549ca4d4614469b5e');
});

test('trusted third engine routes only declared models and keeps separate runtime/context identity',async()=>{
 const calls=[],base={manifest:{contextTokens:4096,runtime:{revision:'base'},models:[{id:'4B',revision:'four'}]},loaded:null,async init(){},async call(cmd){calls.push('base:'+cmd);return{};},async load(id){this.loaded=id;},async unload(){this.loaded=null;calls.push('base:unload');},abort(){},worker:{terminate(){}}};let created=0;
 const models=[{id:'third-a',revision:'a'},{id:'third-b',revision:'b'}],registration={id:'third-engine',modelIds:models.map(m=>m.id),describe:()=>({contextTokens:1024,runtime:{revision:'third-runtime'},models}),create:()=>{created++;return {manifest:{},loaded:null,async init(){},async call(cmd){calls.push('third:'+cmd);return cmd==='count'?{prompt_tokens:17}:{};},async load(id){this.loaded=id;calls.push('third:load');},async unload(){this.loaded=null;calls.push('third:unload');},abort(){calls.push('third:abort');},worker:{terminate(){calls.push('third:terminate');}}};}};
 const router=new TextEngineRouter(base,()=>{throw Error('unused ONNX factory');},[registration]);assert.equal(created,0);await router.load('4B');await router.load('third-a');assert.equal(router.loaded,'third-a');assert.equal(router.manifest.contextTokens,1024);assert.equal(router.manifest.runtime.revision,'third-runtime');assert.deepEqual(await router.call('count',{messages:[]}),{prompt_tokens:17});assert.ok(calls.indexOf('base:unload')<calls.indexOf('third:load'));
 router.abort();assert.equal(router.loaded,null);assert.ok(calls.includes('third:terminate'));await router.load('third-b');assert.equal(created,2);assert.equal(router.loaded,'third-b');await assert.rejects(router.load('undeclared'),/Unknown/);assert.equal(router.loaded,'third-b');
});
test('duplicate model/engine identities and missing revision contracts fail before any factory starts',()=>{
 const base={manifest:{models:[{id:'4B',revision:'four'}]}};let starts=0;
 const r={id:'third-engine',modelIds:['new'],describe:()=>({contextTokens:1024,runtime:{revision:'r'},models:[{id:'new',revision:'v'}]}),create(){starts++;}};
 for(const extra of [[{...r,modelIds:['4B']}],[r,r],[{...r,describe:()=>({contextTokens:0,runtime:{revision:'r'},models:[{id:'new',revision:'v'}]})}],[{...r,describe:()=>({contextTokens:1024,runtime:{revision:'r'},models:[{id:'new',revision:''}]})}]])assert.throws(()=>new TextEngineRouter(base,()=>{},extra),/Invalid/);
 assert.equal(starts,0);
});
