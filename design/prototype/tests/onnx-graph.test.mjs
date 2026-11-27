import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {decisionBackendForModel} from '../src/decision-backend.ts';
import {onnxGraphHasOperator} from '../src/onnx-graph.ts';

const varint=value=>{const bytes=[];while(value>127){bytes.push((value&127)|128);value=Math.floor(value/128);}bytes.push(value);return bytes;};
const field=(number,wire,payload)=>[...varint(number*8+wire),...(wire===2?[...varint(payload.length),...payload]:payload)];
const text=value=>[...new TextEncoder().encode(value)];
const message=(number,payload)=>field(number,2,payload);

test('ONNX graph scanner detects GatherBlockQuantized from a NodeProto op_type',()=>{
 const node=message(4,text('GatherBlockQuantized'));
 const graph=[...message(2,text('GatherBlockQuantized')), ...message(1,node)];
 const model=message(7,graph);
 assert.equal(onnxGraphHasOperator(Uint8Array.from(model),'GatherBlockQuantized'),true);
});

test('ONNX graph scanner does not match graph names or unrelated metadata',()=>{
 const graph=message(2,text('GatherBlockQuantized'));
 assert.equal(onnxGraphHasOperator(Uint8Array.from(message(7,graph)),'GatherBlockQuantized'),false);
 assert.equal(onnxGraphHasOperator(Uint8Array.from(message(3,text('GatherBlockQuantized'))),'GatherBlockQuantized'),false);
});

test('ONNX graph scanner ignores malformed protobuf fields safely',()=>{
 assert.equal(onnxGraphHasOperator(Uint8Array.from([0x3a,0xff,0xff]),'GatherBlockQuantized'),false);
});

test('ONNX graph scanner identifies GatherBlockQuantized in the real operator probe fixture',()=>{
 const fixture=readFileSync(fileURLToPath(new URL('./fixtures/gather-block-quantized-probe.onnx',import.meta.url)));
 const needsWasm=onnxGraphHasOperator(new Uint8Array(fixture.buffer,fixture.byteOffset,fixture.byteLength),'GatherBlockQuantized');
 assert.equal(needsWasm,true);
 assert.equal(decisionBackendForModel({modelId:'custom-decision',requiresGatherBlockQuantized:needsWasm,webgpuAvailable:true}).backend,'wasm');
});
