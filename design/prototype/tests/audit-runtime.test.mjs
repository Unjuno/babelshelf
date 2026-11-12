import test from 'node:test';
import assert from 'node:assert/strict';
import {createIsolatedTextClient} from '../src/isolated-text-client.ts';
import {readDeviceStorage} from '../src/device-storage.ts';
import {Lfm3Adapter} from '../../../dist/lfm-adapter.js';
import {nativeAnswerPreview} from '../../../dist/native-answer-preview.js';

const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
test('silent generation retires its worker, ignores late output and can be retried only in a new worker',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const sent=[];let terminated=0,outcome;
 const worker={postMessage:m=>sent.push(m),terminate:()=>terminated++};
 const client=createIsolatedTextClient(worker,{generationIdleTimeoutMs:1000});
 const pending=client.call('generate',{},()=>assert.fail('late event')).then(value=>outcome=value,error=>outcome=error);
 try{t.mock.timers.tick(1000);await flush();assert.equal(outcome?.code,'text_model_generation_stalled');assert.equal(terminated,1);assert.equal(client.loaded,null);
  worker.onmessage({data:{id:sent[0].id,type:'answer-preview',value:'late'}});
  worker.onmessage({data:{id:sent[0].id,type:'done',value:'late'}});
  await assert.rejects(client.call('generate'),/No text-generation progress/);
 }finally{await client.abort();await pending;}
});
test('actual generation progress renews the idle deadline without limiting the whole answer',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let id,result;const events=[];
 const worker={postMessage:m=>id=m.id,terminate(){}};
 const client=createIsolatedTextClient(worker,{generationIdleTimeoutMs:1000});
 const pending=client.call('generate',{},(type,value)=>events.push([type,value])).then(value=>result=value,error=>result=error);
 try{for(let i=0;i<5;i++){t.mock.timers.tick(900);worker.onmessage({data:{id,type:'progress',value:'Thinking'}});await flush();assert.equal(result,undefined);}
  worker.onmessage({data:{id,type:'done',value:'complete'}});await pending;assert.equal(result,'complete');assert.equal(events.length,5);
  t.mock.timers.tick(10000);assert.equal(client.failed,false);
 }finally{await client.abort();}
});
test('device storage check returns partial measurements when another browser probe never resolves',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let result;
 void readDeviceStorage({estimate:async()=>({usage:20,quota:100}),persisted:()=>new Promise(()=>{})}).then(value=>result=value);
 await flush();t.mock.timers.tick(8000);await flush();
 assert.deepEqual(result,{usage:20,quota:100,available:80,persistent:null,canRequest:false});
});
test('native reasoning and action streaming report real progress without exposing their contents',async()=>{
 const progress=[];let time=0;
 const adapter=new Lfm3Adapter({Wllama:class{},paths:{default:'wasm'},compat:{wasm:'compat',worker:{code:''}},models:[],clock:()=>time,onProgress:value=>progress.push(value)});
 adapter.loaded='test';adapter.runtime={createChatCompletion:async()=> (async function*(){
  time+=1000;yield {choices:[{delta:{reasoning_content:'private reasoning'}}]};
  time+=1000;yield {choices:[{delta:{tool_calls:[{index:0,function:{name:'finish_chat',arguments:'{"reply":{"answer":"Hello"}}'}}]}}]};
 })()};
 await adapter.generate([{role:'user',content:'hi'}],{json:false,maxTokens:64});
 assert.ok(progress.includes('Thinking'));assert.ok(progress.includes('Generating answer'));
 assert.ok(progress.every(value=>!value.includes('private')&&!value.includes('Hello')&&!value.includes('finish_chat')));
});
test('terminal chat previews contain only the partial answer',()=>{
 const args='{"reply":{"answer":"Hello';
 assert.equal(nativeAnswerPreview(new Map([[0,{name:'finish_chat',arguments:args}]])),'Hello');
 assert.equal(nativeAnswerPreview(new Map([[0,{name:'finish_chat',arguments:'{"reasoning":"private"'}]])),'');
});
