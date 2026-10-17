import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {hashLocalModel,validateLocalModel} from '../dist/local-models.js';

const digest='a'.repeat(64);
const record=()=>({id:'local-'+digest,label:'My model',role:'text',engine:'webml-qwen35',revision:'sha256:'+digest,file:{bytes:1000,sha256:digest},inspection:{format:'GGUF',version:3,bytes:1000,name:'My model',architecture:'qwen35',contextLength:4096,tokenizer:'gpt2',chatTemplate:true,tokenCount:1024,tensorCount:1,tensorTypes:[143],tensorExtentsChecked:true,dataOffset:512}});
test('custom model records are strict declarative identity, never runtime code or readiness',()=>{
 const value=record();assert.deepEqual(validateLocalModel(value),value);
 for(const change of [r=>r.engine='remote',r=>r.role='decision',r=>r.id='4B',r=>r.file.url='https://example.com/weights',r=>r.runtime='script.js',r=>r.ready=true,r=>r.inspection.architecture='llama',r=>r.file.bytes=999,r=>r.inspection.tensorTypes=[143,143],r=>r.label='bad\0name']){const r=record();change(r);assert.throws(()=>validateLocalModel(r),/model/i);}
});
test('local weight hashing streams exact bytes and cancellation cannot return a verified digest',async()=>{
 const bytes=new Uint8Array(200000).fill(73),blob=new Blob([bytes]);
 assert.equal(await hashLocalModel(blob),createHash('sha256').update(bytes).digest('hex'));
 const c=new AbortController();let cancelled=false,released=false;
 const file={size:1,stream:()=>({getReader:()=>({async read(){c.abort();return {value:new Uint8Array([1]),done:false};},async cancel(){cancelled=true;},releaseLock(){released=true;}})})};
 await assert.rejects(hashLocalModel(file,{signal:c.signal}),{name:'AbortError'});assert.ok(cancelled&&released);
});

test('cached weight streams yield to queued Stop before verification completes',async()=>{
 const controller=new AbortController();let cancelled=false,released=false,reads=0;
 const chunk=new Uint8Array(65536);
 const file={size:32*1024*1024,stream:()=>({getReader:()=>({async read(){return ++reads<=512?{value:chunk,done:false}:{done:true};},async cancel(){cancelled=true;},releaseLock(){released=true;}})})};
 const timer=setTimeout(()=>controller.abort(),0);
 try{await assert.rejects(hashLocalModel(file,{signal:controller.signal}),{name:'AbortError'});assert.ok(cancelled&&released);assert.ok(reads<512);}finally{clearTimeout(timer);}
});

test('Stop cancels a pending local weight read',async()=>{
 const controller=new AbortController();let settle,cancelled=false,released=false;
 const file={size:1,stream:()=>({getReader:()=>({read(){return new Promise(resolve=>{settle=resolve;});},async cancel(){cancelled=true;settle?.({done:true});},releaseLock(){released=true;}})})};
 const pending=hashLocalModel(file,{signal:controller.signal});controller.abort();
 await assert.rejects(pending,{name:'AbortError'});assert.ok(cancelled&&released);
});
