import test from 'node:test';import assert from 'node:assert/strict';import {DecisionClient} from '../src/decision-control.ts';
const factory=()=>{const workers=[];return {workers,create(){const w={messages:[],terminated:false,postMessage(m){this.messages.push(m);},terminate(){this.terminated=true;},reply(value){this.onmessage({data:{id:this.messages[0].id,value}});}};workers.push(w);return w;}};};
test('decision Stop discards inference worker and ignores stale completion on the replacement worker',async()=>{
 const f=factory(),c=new DecisionClient(()=>f.create(),()=>{}),first=c.call('classify');c.stop();await assert.rejects(first,/Stopped/);assert.ok(f.workers[0].terminated);const second=c.call('status');f.workers[0].reply({loaded:true});f.workers[1].reply({prepared:true});assert.deepEqual(await second,{prepared:true});c.dispose();
});
test('preparation Stop waits for writer cleanup acknowledgement and cannot begin a competing command',async()=>{
 const f=factory(),c=new DecisionClient(()=>f.create(),()=>{}),job=c.call('prepare');c.stop();assert.equal(f.workers[0].messages.at(-1).type,'abort');assert.equal(f.workers[0].terminated,false);await assert.rejects(c.call('load'),/busy/i);f.workers[0].onmessage({data:{id:f.workers[0].messages[0].id,error:'Stopped'}});await assert.rejects(job,/Stopped/);const next=c.call('status');f.workers[0].onmessage({data:{id:f.workers[0].messages.at(-1).id,value:{prepared:false}}});assert.deepEqual(await next,{prepared:false});c.dispose();
});
test('worker crash and post failure reject exactly one request and permit a fresh worker retry',async()=>{
 const f=factory(),c=new DecisionClient(()=>f.create(),()=>{}),p=c.call('load');f.workers[0].onerror();await assert.rejects(p,/runtime failed/i);assert.ok(f.workers[0].terminated);const next=c.call('status');f.workers[1].reply({prepared:false});await next;c.dispose();
 const throwing=new DecisionClient(()=>({postMessage(){throw Error('Clone failed');},terminate(){}}),()=>{});await assert.rejects(throwing.call('classify'),/Clone failed/);await assert.rejects(throwing.call('status'),/Clone failed/);throwing.dispose();
});

test('loaded lifecycle resets only when the worker is discarded, preserving a graceful preparation abort',async()=>{
 const f=factory();let loaded=false,resets=0;const c=new DecisionClient(()=>f.create(),()=>{},()=>{loaded=false;resets++;});
 const load=c.call('load');f.workers[0].reply({loaded:true});loaded=(await load).loaded;
 const prep=c.call('prepare');c.stop();assert.equal(loaded,true);assert.equal(resets,0);
 f.workers[0].onmessage({data:{id:f.workers[0].messages.at(-2).id,error:'Stopped'}});await assert.rejects(prep,/Stopped/);assert.equal(loaded,true);
 const inference=c.call('classify');f.workers[0].onerror();await assert.rejects(inference,/runtime failed/i);assert.equal(loaded,false);assert.equal(resets,1);
 c.dispose();
});

test('worker context-limit code is typed but cancelled requests never inherit a fallback code',async()=>{
 const f=factory(),c=new DecisionClient(()=>f.create(),()=>{});assert.equal(c.working,false);
 const limit=c.call('classify');assert.equal(c.working,true);f.workers[0].onmessage({data:{id:f.workers[0].messages.at(-1).id,error:'Decision context limit',code:'decision_context_limit'}});await assert.rejects(limit,e=>e.code==='decision_context_limit');assert.equal(c.working,false);
 const stopped=c.call('classify');c.stop();await assert.rejects(stopped,e=>e.message==='Stopped'&&!e.code);assert.equal(c.working,false);c.dispose();
});

test('classification retires the decision worker before success or typed failure reaches text continuation',async()=>{
 const f=factory();let resets=0;const c=new DecisionClient(()=>f.create(),()=>{},()=>resets++);
 const first=c.call('classify');f.workers[0].reply({answer:'observed'});const result=await first;
 assert.deepEqual(result,{answer:'observed'});assert.equal(f.workers[0].terminated,true);assert.equal(c.active,false);assert.equal(c.working,false);assert.equal(resets,1);
 const load=c.call('load');assert.equal(f.workers.length,2);f.workers[0].reply({answer:'late'});f.workers[1].reply({loaded:true});await load;
 const failed=c.call('classify');f.workers[1].onmessage({data:{id:f.workers[1].messages.at(-1).id,error:'too long',code:'decision_context_limit'}});
 await assert.rejects(failed,e=>e.code==='decision_context_limit');assert.equal(f.workers[1].terminated,true);assert.equal(c.active,false);assert.equal(resets,2);
 const status=c.call('status');f.workers[2].reply({prepared:true,loaded:false});assert.deepEqual(await status,{prepared:true,loaded:false});assert.equal(f.workers[2].terminated,false);c.dispose();
});

test('malformed current worker messages reject the request instead of leaving the route pending',async()=>{
 for(const message of [id=>null, id=>({progress:'Loading'}),id=>({id,progress:42}),id=>({id,value:{loaded:true},permission:'tool'}),id=>({id,error:'failed',code:'run_tool'})]){
  const f=factory(),c=new DecisionClient(()=>f.create(),()=>{}),request=c.call('classify');
  f.workers[0].onmessage({data:message(f.workers[0].messages[0].id)});
  await assert.rejects(request,/Decision runtime failed/);assert.equal(c.working,false);assert.equal(f.workers[0].terminated,true);c.dispose();
 }
});
