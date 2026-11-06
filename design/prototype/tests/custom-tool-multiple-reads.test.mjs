import test from 'node:test';
import assert from 'node:assert/strict';
import {runCustomToolSource} from '../src/custom-tool-runtime.ts';
import {beginCustomEvidence} from '../src/agent-evidence.ts';

test('a custom tool can perform more than eight sequential local reads',async()=>{
 const previous=globalThis.Worker;let worker;
 class FakeWorker{
  constructor(){worker=this;this.sent=[];}
  postMessage(message){this.sent.push(message);}
  terminate(){}
  reply(message){this.onmessage({data:message});}
 }
 globalThis.Worker=FakeWorker;
 try{
  let count=0;const observed=beginCustomEvidence({check(){},search:async()=>[],resolve:async query=>{count++;return [{id:query,path:`Inbox/${query}.md`,version:1,body:`Original ${query}`}];}},[]);
  const pending=runCustomToolSource({code:'tool',input:{},capabilities:['memory.read'],host:{read:(query,signal)=>observed.host.resolve(query,signal)}});pending.catch(()=>{});
  worker.reply({type:'running'});
  for(let id=0;id<9;id++){
   worker.reply({type:'capability',requestId:id,capability:'memory.read',query:`note-${id}`});
   await new Promise(resolve=>setImmediate(resolve));
  }
  assert.equal(count,9);worker.reply({type:'result',value:'done'});assert.equal(await pending,'done');
  const evidence=observed.commit();assert.equal(evidence.length,9);for(let id=0;id<9;id++)assert.ok(evidence.some(ref=>ref.noteId===`note-${id}`&&ref.revision===1&&ref.quote===`Original note-${id}`));
 }finally{globalThis.Worker=previous;}
});
