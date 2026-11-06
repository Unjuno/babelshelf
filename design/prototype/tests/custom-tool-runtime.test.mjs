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

test('decimal calculator is available only with the existing calculator capability',async()=>{
 const receipt={schema:1,expression:'0.1 + 0.2',result:'0.3',precision:'decimal',rounding:'half-even',places:18,rounded:false};
 const pending=runCustomToolSource({code:'tool',input:{},capabilities:['math.calculate'],host:{calculateDecimal:()=>receipt}}),worker=workers.at(-1);
 worker.reply({type:'capability',requestId:1,capability:'math.calculate.decimal',query:receipt.expression});
 for(let i=0;i<4&&worker.sent.length<2;i++)await Promise.resolve();
 assert.deepEqual(worker.sent[1],{type:'capability-result',requestId:1,value:receipt});
 worker.reply({type:'result',value:'done'});assert.equal(await pending,'done');
 const denied=runCustomToolSource({code:'tool',input:{},capabilities:[],host:{calculateDecimal:()=>receipt}}),deniedWorker=workers.at(-1);
 deniedWorker.reply({type:'capability',requestId:2,capability:'math.calculate.decimal',query:receipt.expression});
 await assert.rejects(denied,/capability is not available/);
 const oversized=runCustomToolSource({code:'tool',input:{},capabilities:['math.calculate'],host:{calculateDecimal:()=>{throw Error('must not run');}}}),oversizedWorker=workers.at(-1);
 oversizedWorker.reply({type:'capability',requestId:3,capability:'math.calculate.decimal',query:'1'.repeat(201)});
 await assert.rejects(oversized,/capability is not available/);
});

test('real QuickJS worker exposes both calculation helpers only when declared',async()=>{
 const {spawnSync}=await import('node:child_process');
 const workerUrl=new URL('../src/custom-tool-worker.ts',import.meta.url).href;
 const script=`let done;globalThis.postMessage=m=>{if(m.type==='capability')setTimeout(()=>globalThis.onmessage({data:{type:'capability-result',requestId:m.requestId,value:m.capability==='math.calculate'?0.30000000000000004:{result:'0.3',rounded:false}}}),0);if(m.type==='result'||m.type==='error')done(m)};
 await import(${JSON.stringify(workerUrl)});
 async function run(code,capabilities){const wait=new Promise(resolve=>done=resolve);globalThis.onmessage({data:{type:'run',code,input:{},capabilities,timeoutMs:750,memoryLimitBytes:8388608}});return await wait;}
 const result=await run('({capabilities})=>({legacy:capabilities.calculate("0.1+0.2"),decimal:capabilities.calculateDecimal("0.1+0.2")})',['math.calculate']);
 if(result.type!=='result'||result.value.legacy!==0.30000000000000004||result.value.decimal.result!=='0.3')throw Error('calculator bridge failed');
 const denied=await run('({capabilities})=>({decimal:typeof capabilities.calculateDecimal})',[]);
 if(denied.type!=='result'||denied.value.decimal!=='undefined')throw Error('undeclared calculator exposed');`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:10000});
 assert.equal(child.status,0,child.stderr||child.stdout);
});

test('brokers a declared, validated Memory folder listing and rejects undeclared access',async()=>{
 let request;
 const pending=runCustomToolSource({code:'tool',input:{},capabilities:['memory.list'],host:{list:async(path,offset,limit)=>{request={path,offset,limit};return {path,entries:[{kind:'file',name:'note.md',path:'Notes/note.md',id:'n1',version:2}],offset,limit,total:1,hasMore:false,nextOffset:null};}}});
 const worker=workers.at(-1);worker.reply({type:'capability',requestId:5,capability:'memory.list',query:'{"path":"Notes","offset":0,"limit":10}'});
 for(let i=0;i<4&&worker.sent.length<2;i++)await Promise.resolve();
 assert.deepEqual(request,{path:'Notes',offset:0,limit:10});
 assert.equal(worker.sent[1].value.entries[0].id,'n1');
 worker.reply({type:'result',value:'done'});assert.equal(await pending,'done');
 const denied=runCustomToolSource({code:'tool',input:{},capabilities:[]}),deniedWorker=workers.at(-1);
 deniedWorker.reply({type:'capability',requestId:6,capability:'memory.list',query:'{"path":"","offset":0,"limit":10}'});
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
 for(let requestId=0;requestId<64;requestId++){
  totalWorker.reply({type:'capability',requestId,capability:'memory.search',query:'bounded'});
  await new Promise(resolve=>setImmediate(resolve));
 }
 totalWorker.reply({type:'capability',requestId:64,capability:'memory.search',query:'over budget'});
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

test('real QuickJS async Memory capability releases runtime without an unhandled rejection',async()=>{
 const {spawnSync}=await import('node:child_process');
 const workerUrl=new URL('../src/custom-tool-worker.ts',import.meta.url).href;
 const script=`process.on('unhandledRejection',error=>{console.error('unhandled:',error.message);process.exitCode=2;});
 let done;globalThis.postMessage=m=>{if(m.type==='capability')setTimeout(()=>globalThis.onmessage({data:{type:'capability-result',requestId:m.requestId,value:[{body:'hello'}]}}),0);if(m.type==='result'||m.type==='error')done(m)};
 await import(${JSON.stringify(workerUrl)});
 async function run(code){const wait=new Promise(resolve=>done=resolve);globalThis.onmessage({data:{type:'run',code,input:{},capabilities:['memory.read'],timeoutMs:750,memoryLimitBytes:8388608}});const result=await wait;await new Promise(resolve=>setTimeout(resolve,50));return result;}
 const failed=await run('({capabilities})=>{capabilities.memoryRead("one");throw Error("expected failure")}');
 if(failed.type!=='error')throw Error('expected failure missing');
 const timedOut=await run('({capabilities})=>{capabilities.memoryRead("one");while(true){}}');
 if(timedOut.type!=='error'||timedOut.message!=='Custom tool time limit exceeded')throw Error('timeout missing');
 const result=await run('({capabilities})=>({value:capabilities.memoryRead("one")[0].body})');
 if(result.type!=='result'||result.value.value!=='hello')throw Error('retry failed');`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:10000});
 assert.equal(child.status,0,child.stderr||child.stdout);
});
