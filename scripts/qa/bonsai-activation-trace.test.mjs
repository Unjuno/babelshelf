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
