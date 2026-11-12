import test from 'node:test';
import assert from 'node:assert/strict';
import {LogitsProcessor,LogitsProcessorList} from '../node_modules/@huggingface/transformers/dist/transformers.node.mjs';
import {OnnxGenerationProgress} from '../src/onnx-generation-progress.ts';
import {createIsolatedTextClient} from '../src/isolated-text-client.ts';
import {createStructuredTokenFilter} from '../src/structured-decoding.ts';

test('actual logits steps emit only a fixed phase, leave IDs/scores unchanged and do not create heartbeats',t=>{
 t.mock.timers.enable({apis:['setTimeout']});let now=0,checks=0;const progress=[];
 const processors=new LogitsProcessorList();processors.push(new OnnxGenerationProgress(()=>checks++,value=>progress.push(value),()=>now));
 const ids=[[123456789n]],logits={data:new Float32Array([3,-Infinity,7]),dispose(){assert.fail('progress must not own tensors');}},before=structuredClone({ids,data:logits.data});
 assert.equal(processors(ids,logits),logits);assert.deepEqual(progress,['Generating tokens']);
 now=500;processors(ids,logits);assert.equal(progress.length,1);assert.equal(checks,2);
 t.mock.timers.tick(10000);assert.equal(progress.length,1,'elapsed time alone never sends progress');
 now=1500;processors(ids,logits);assert.deepEqual(progress,['Generating tokens','Generating tokens']);
 assert.deepEqual({ids,data:logits.data},before);assert.doesNotMatch(JSON.stringify(progress),/123456789|Infinity|logits/);
});

test('progress composes with the actual structured logits mask and Stop prevents later processing',()=>{
 const decoder=Object.fromEntries(Array.from({length:256},(_,i)=>[String.fromCodePoint(i),String(i)]));
 const filter=createStructuredTokenFilter('dialogue-answer',{decoder:{byte_decoder:decoder},model:{vocab:[...Array.from({length:256},(_,i)=>String.fromCodePoint(i)),'EOS']},all_special_ids:[256]},256);
 let masks=0;const progress=[],controller=new AbortController(),processors=new LogitsProcessorList();
 processors.push(new OnnxGenerationProgress(()=>controller.signal.throwIfAborted(),value=>progress.push(value)));
 class FormatProcessor extends LogitsProcessor{_call(ids,logits){masks++;filter.mask(ids[0],logits.data);return logits;}}
 processors.push(new FormatProcessor());
 const logits={data:new Float32Array(257).fill(3)};
 assert.equal(processors([[]],logits),logits);assert.equal(logits.data[123],3);assert.equal(logits.data[73],-Infinity);assert.equal(logits.data[256],-Infinity);
 controller.abort(Error('Stopped'));assert.throws(()=>processors([[]],logits),/Stopped/);
 assert.equal(masks,1);assert.deepEqual(progress,['Generating tokens']);
});

test('ONNX logits progress keeps a long generation alive, then genuine silence retires the worker once',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let now=0,id,terminated=0,outcome;
 const worker={postMessage:message=>{id=message.id;},terminate:()=>terminated++};
 const client=createIsolatedTextClient(worker,{generationIdleTimeoutMs:3000});
 const processors=new LogitsProcessorList();processors.push(new OnnxGenerationProgress(()=>{},value=>worker.onmessage({data:{id,type:'progress',value}}),()=>now));
 const pending=client.call('generate',{}).then(value=>outcome=value,error=>outcome=error);
 for(let step=0;step<5;step++){
  t.mock.timers.tick(2500);now+=2500;processors([[BigInt(step)]],{data:new Float32Array([1])});await Promise.resolve();assert.equal(outcome,undefined);
 }
 assert.equal(terminated,0);t.mock.timers.tick(3000);await pending;
 assert.equal(outcome.code,'text_model_generation_stalled');assert.equal(terminated,1);assert.equal(client.loaded,null);await client.abort();
});
