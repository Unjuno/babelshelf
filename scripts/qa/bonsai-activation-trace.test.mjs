import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize,instrumentRuntime,createActivationTracer} from './bonsai-activation-trace.mjs';
test('nonfinite values remain explicit while finite statistics and smallest argmax are preserved',()=>{
 assert.deepEqual(summarize(new Float32Array([NaN,Infinity,-Infinity,0,-2,2,2]),'float32'),{elements:7,finite:4,nan:1,infinity:2,zeros:1,firstNonfinite:0,min:-2,max:2,mean:.5,variance:2.75,argmax:5});
 const empty=summarize(new Float32Array([NaN,NaN]),'float32');assert.equal(empty.finite,0);assert.equal(empty.nan,2);assert.equal(empty.argmax,null);assert.equal(empty.variance,null);
});
test('f16 bit patterns are interpreted numerically rather than counted as unsigned integers',()=>{
 const s=summarize(new Uint16Array([0x0001,0xbc00,0x3c00,0x7c00,0x7e00]),'float16');assert.equal(s.min,-1);assert.equal(s.max,1);assert.equal(s.argmax,2);assert.equal(s.nan,1);assert.equal(s.infinity,1);assert.equal(s.finite,3);assert.equal(s.zeros,0);
});
test('trace limits and runtime identity fail before observation/instrumentation',()=>{
 assert.throws(()=>instrumentRuntime(Buffer.from('not the pinned runtime')),/exact inspected runtime/);
 assert.throws(()=>createActivationTracer({onSnapshot(){},maxSnapshots:17}),/Invalid trace bounds/);
 const original=()=>{},runtime={readTensor:original},tracer=createActivationTracer({onSnapshot(){},maxReadBytes:4});
 assert.throws(()=>tracer.compiled(runtime,{}, {tensors:[{kind:'output',name:'__babelTrace.fixture.logits',dtype:'float32',shape:[2]}]}),/readback budget/);assert.equal(runtime.readTensor,original);tracer.dispose();
});

test('actual decode graph watches its in-place input_ids readback rather than the prefill next_token name',async()=>{
 const token={dtype:'uint32',buffer:{},byteOffset:0,byteLength:4},logits={dtype:'float32',buffer:{},byteOffset:0,byteLength:8},snapshots=[],lookups=[];
 const runtime={async readTensor(t){return t===logits?new Float32Array([-1,2]):new Uint32Array([1]);}},original=runtime.readTensor;
 const program={tensor(name){lookups.push(name);if(name==='input_ids')return token;if(name==='__babelTrace.head.logits')return logits;throw Error('Unbound '+name);}},graph={name:'qwen35-decode',tensors:[{kind:'output',name:'__babelTrace.head.logits',dtype:'float32',shape:[2]}]},tracer=createActivationTracer({onSnapshot:s=>snapshots.push(s)});
 tracer.compiled(runtime,program,graph);assert.deepEqual([...await runtime.readTensor(token)],[1]);assert.equal(snapshots.length,1);assert.equal(snapshots[0].tensors[0].argmax,1);assert.equal(snapshots[0].graph,'qwen35-decode');assert.ok(!lookups.includes('next_token'));tracer.dispose();assert.equal(runtime.readTensor,original);
});

test('warmup readbacks cannot consume a generation-only snapshot budget',async()=>{
 let armed=false;const token={dtype:'uint32',buffer:{},byteOffset:0,byteLength:4},score={dtype:'float32',buffer:{},byteOffset:0,byteLength:4},snapshots=[];
 const runtime={async readTensor(t){return t===score?new Float32Array([2]):new Uint32Array([0]);}},program={tensor(name){return name==='next_token'?token:score;}},graph={name:'qwen35-prefill',tensors:[{kind:'output',name:'__babelTrace.logits',dtype:'float32',shape:[1]}]};
 const tracer=createActivationTracer({onSnapshot:s=>snapshots.push(s),shouldObserve:()=>armed,maxSnapshots:1});tracer.compiled(runtime,program,graph);
 await runtime.readTensor(token);assert.equal(tracer.snapshots,0);armed=true;await runtime.readTensor(token);assert.equal(tracer.snapshots,1);assert.equal(snapshots.length,1);tracer.dispose();
});
