import test from 'node:test';
import assert from 'node:assert/strict';

const workers=[];
class FakeWorker{
 constructor(url,options){this.url=String(url);this.options=options;this.sent=[];this.terminated=false;workers.push(this);}
 postMessage(message){this.sent.push(message);if(message.type==='run')queueMicrotask(()=>this.reply({type:'running'}));}
 terminate(){this.terminated=true;}
 reply(message){this.onmessage?.({data:message});}
}
globalThis.Worker=FakeWorker;
const {runCustomToolSource}=await import('../src/custom-tool-runtime.ts');

test('requests execution in a fresh module worker with only bounded package inputs',async()=>{
 const pending=runCustomToolSource({code:'({ input }) => input',input:{x:1},capabilities:[]});
 const worker=workers.at(-1);assert.match(worker.url,/custom-tool-worker\.ts$/);assert.deepEqual(worker.options,{type:'module',name:'BabelShelf custom tool'});
 assert.deepEqual(worker.sent[0],{type:'run',code:'({ input }) => input',input:{x:1},capabilities:[],timeoutMs:750,memoryLimitBytes:8*1024*1024});
 worker.reply({type:'result',value:{ok:true}});assert.deepEqual(await pending,{ok:true});assert.equal(worker.terminated,true);
});

test('brokers only declared memory capabilities and copies bounded JSON results',async()=>{
 let searched='';
 const pending=runCustomToolSource({code:'tool',input:{},capabilities:['memory.search'],host:{search:async query=>{searched=query;return [{id:'n1'}];}}});
 const worker=workers.at(-1),request={type:'capability',requestId:4,capability:'memory.search',query:'rain'};worker.reply(request);
 for(let i=0;i<4&&worker.sent.length<2;i++)await Promise.resolve();
 assert.equal(searched,'rain');assert.deepEqual(worker.sent[1],{type:'capability-result',requestId:4,value:[{id:'n1'}]});
 worker.reply({type:'result',value:'done'});assert.equal(await pending,'done');
});

test('brokers the declared local calculator and rejects undeclared calculator access',async()=>{
 let expression='';
 const pending=runCustomToolSource({code:'tool',input:{},capabilities:['math.calculate'],host:{calculate:async value=>{expression=value;return 42;}}});
 const worker=workers.at(-1);worker.reply({type:'capability',requestId:1,capability:'math.calculate',query:'6 * 7'});
 for(let i=0;i<4&&worker.sent.length<2;i++)await Promise.resolve();
 assert.equal(expression,'6 * 7');assert.deepEqual(worker.sent[1],{type:'capability-result',requestId:1,value:42});
 worker.reply({type:'result',value:'done'});assert.equal(await pending,'done');
 const denied=runCustomToolSource({code:'tool',input:{},capabilities:[]}),deniedWorker=workers.at(-1);
 deniedWorker.reply({type:'capability',requestId:2,capability:'math.calculate',query:'1 + 1'});
 await assert.rejects(denied,/capability is not available/);assert.equal(deniedWorker.terminated,true);
});

test('does not pass private host exception text into custom tool code',async()=>{
 const pending=runCustomToolSource({code:'tool',input:{},capabilities:['memory.search'],host:{search:async()=>{throw Error('PRIVATE_PATH_AND_QUERY');}}});
 const worker=workers.at(-1);worker.reply({type:'capability',requestId:4,capability:'memory.search',query:'private query'});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(worker.sent.at(-1),{type:'capability-error',requestId:4,message:'Memory capability failed'});
 worker.reply({type:'error',message:'Custom tool failed · inspect package source and selected capabilities'});
 await assert.rejects(pending,/Custom tool failed/);
 assert.doesNotMatch(JSON.stringify(worker.sent),/PRIVATE_PATH_AND_QUERY|private query/);
});

test('refuses undeclared capabilities, malformed worker messages and oversized results',async()=>{
 const pending=runCustomToolSource({code:'tool',input:{},capabilities:[]});const worker=workers.at(-1);
 worker.reply({type:'capability',requestId:1,capability:'memory.read',query:'anything'});await assert.rejects(pending,/capability is not available/);assert.equal(worker.terminated,true);
 const oversized=runCustomToolSource({code:'tool',input:{},capabilities:[]});workers.at(-1).reply({type:'result',value:'x'.repeat(9000)});await assert.rejects(oversized,/result exceeds its size limit/);
});

test('does not persist exception text emitted by custom tool code',async()=>{
 const pending=runCustomToolSource({code:'tool',input:{},capabilities:[]}),worker=workers.at(-1);
 worker.reply({type:'error',message:'PRIVATE_NOTE_EXCERPT_FROM_USER_CODE'});
 await assert.rejects(pending,error=>{
  assert.equal(error.message,'Custom tool failed · inspect package source and selected capabilities');
  assert.doesNotMatch(error.message,/PRIVATE_NOTE_EXCERPT/);
  return true;
 });
});

test('rejects invalid capabilities, source, inputs and runtime budgets before starting a worker',()=>{
 const before=workers.length;
 assert.throws(()=>runCustomToolSource({code:'x'.repeat(32001),input:{},capabilities:[]}),/source too large/);
 assert.throws(()=>runCustomToolSource({code:'x',input:{x:'x'.repeat(9000)},capabilities:[]}),/input exceeds/);
 assert.throws(()=>runCustomToolSource({code:'x',input:{},capabilities:['network.fetch']}),/capabilities/);
 assert.throws(()=>runCustomToolSource({code:'x',input:{},capabilities:[],timeoutMs:5000}),/runtime limits/);
 assert.equal(workers.length,before);
});

test('terminates stalled workers at the hard timeout',async()=>{
 const pending=runCustomToolSource({code:'while (true) {}',input:{},capabilities:[],timeoutMs:10});const worker=workers.at(-1);
 await assert.rejects(pending,/time limit/);assert.equal(worker.terminated,true);
});

test('bounds custom tool memory calls by total and concurrent host work',async()=>{
 let started=0;
 const pending=runCustomToolSource({code:'tool',input:{},capabilities:['memory.search'],host:{search:()=>{started++;return new Promise(()=>{});}}});
 const worker=workers.at(-1);
 worker.reply({type:'capability',requestId:0,capability:'memory.search',query:'one'});
 worker.reply({type:'capability',requestId:1,capability:'memory.search',query:'two'});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(started,2);
 worker.reply({type:'capability',requestId:2,capability:'memory.search',query:'three'});
 await assert.rejects(pending,/concurrent capability limit/);
 assert.equal(started,2);
 assert.equal(worker.terminated,true);

 const total=runCustomToolSource({code:'tool',input:{},capabilities:['memory.search'],host:{search:async()=>({ok:true})}});
 const totalWorker=workers.at(-1);
 for(let requestId=0;requestId<8;requestId++){
  totalWorker.reply({type:'capability',requestId,capability:'memory.search',query:'bounded'});
  await new Promise(resolve=>setImmediate(resolve));
 }
 totalWorker.reply({type:'capability',requestId:8,capability:'memory.search',query:'over budget'});
 await assert.rejects(total,/call limit/);
 assert.equal(totalWorker.terminated,true);
});

test('caller cancellation terminates the worker and aborts pending host work',async()=>{
 const controller=new AbortController();let hostSignal;
 const pending=runCustomToolSource({code:'tool',input:{},capabilities:['memory.search'],signal:controller.signal,host:{search:(_query,signal)=>{hostSignal=signal;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('Stopped')),{once:true}));}}});
 const worker=workers.at(-1);worker.reply({type:'capability',requestId:0,capability:'memory.search',query:'wait'});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(hostSignal.aborted,false);
 controller.abort();await assert.rejects(pending,/Stopped/);
 assert.equal(hostSignal.aborted,true);assert.equal(worker.terminated,true);
});
