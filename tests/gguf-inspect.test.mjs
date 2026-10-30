import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectGGUF} from '../dist/gguf-inspect.js';
import {localEngine,eligibleTextEngine} from '../dist/local-engines.js';
import {inspectLocalModel} from '../dist/local-models.js';

const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
const u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;};
const str=s=>Buffer.concat([u64(Buffer.byteLength(s)),Buffer.from(s)]);
function gguf({arch='qwen35',tensorType=143,elements=128,contextLength=4096,duplicate=false}={}){
 const entries=[['general.architecture',8,str(arch)],['general.name',8,str('User 日本語')],[arch+'.context_length',4,u32(contextLength)],['tokenizer.ggml.model',8,str('gpt2')],['tokenizer.chat_template',8,str('{{ messages }}')],['tokenizer.ggml.tokens',9,Buffer.concat([u32(8),u64(2),str('a'),str('b')])]];
 if(duplicate)entries.push(entries[0]);
 const h=Buffer.concat([Buffer.from('GGUF'),u32(3),u64(1),u64(entries.length),...entries.map(([k,t,v])=>Buffer.concat([str(k),u32(t),v])),str('weight'),u32(1),u64(elements),u32(tensorType),u64(0)]);
 const padding=(32-h.length%32)%32;return Buffer.concat([h,Buffer.alloc(padding),Buffer.alloc(512)]);
}
function q2Pair(secondOffset){
 const arch='qwen3',entries=[['general.architecture',8,str(arch)],['tokenizer.ggml.model',8,str('gpt2')]];
 const tensor=(name,offset)=>Buffer.concat([str(name),u32(1),u64(2048),u32(42),u64(offset)]);
 const header=Buffer.concat([Buffer.from('GGUF'),u32(3),u64(2),u64(entries.length),...entries.map(([key,type,value])=>Buffer.concat([str(key),u32(type),value])),tensor('first',0),tensor('second',secondOffset)]);
 return Buffer.concat([header,Buffer.alloc((32-header.length%32)%32),Buffer.alloc(secondOffset+576)]);
}
test('bounded inspection preserves model data without executing templates or unbounded reads',async()=>{
 const bytes=gguf(),blob=new Blob([bytes]);let read=0;
 const limited={size:blob.size,slice(start,end){read+=Math.min(end,blob.size)-start;return blob.slice(start,end);}};
 const v=await inspectGGUF(limited);
 assert.equal(v.architecture,'qwen35');assert.equal(v.name,'User 日本語');assert.equal(v.contextLength,4096);assert.equal(v.tokenizer,'gpt2');assert.equal(v.chatTemplate,true);assert.equal(v.tokenCount,2);assert.deepEqual(v.tensorTypes,[143]);assert.equal(v.tensorCount,1);assert.ok(read<=16*1024*1024);
 assert.equal(eligibleTextEngine(v).id,'webml-qwen35');assert.equal(localEngine('transformers-whisper-wasm').custom,false);
});
test('malformed and unbounded GGUF metadata fails before an engine can be selected',async()=>{
 for(const bytes of [Buffer.from('ONNX'),gguf().subarray(0,28),gguf({duplicate:true}),Buffer.concat([Buffer.from('GGUF'),u32(3),u64(1),u64(10000000)])])await assert.rejects(inspectGGUF(new Blob([bytes])),/GGUF/);
 const b=gguf();b.writeBigUInt64LE(2n**63n,24);await assert.rejects(inspectGGUF(new Blob([b])),/GGUF/);
});
test('valid container does not mean an architecture or quantization is supported',async()=>{
 const other=await inspectGGUF(new Blob([gguf({arch:'llama'})]));assert.equal(eligibleTextEngine(other),undefined);
 const quant=await inspectGGUF(new Blob([gguf({tensorType:12})]));assert.equal(eligibleTextEngine(quant),undefined);
 assert.equal(localEngine('user-script'),undefined);
});
test('private Qwen3 PQ2 remains refused before hashing while official Q2 resolves to CPU',async()=>{
 const accepted=await inspectLocalModel(new Blob([gguf({arch:'qwen3',tensorType:42})]));assert.equal(accepted.engine,'wllama-qwen3');
 for(const [type,format] of [[142,'PQ2_0']]){
  const bytes=gguf({arch:'qwen3',tensorType:type}),blob=new Blob([bytes]);let read=0;
  const file={size:blob.size,slice(start,end){read++;return blob.slice(start,end);},stream(){throw Error('Unsupported model must not be hashed');}};
  await assert.rejects(inspectLocalModel(file),new RegExp(`Qwen3 ${format} GGUF cannot run here`));
  assert.equal(read,1);
 }
});
test('an LFM2 GGUF with the pinned CPU engines tokenizer and checked supported block types resolves to its app-owned adapter',async()=>{
 const info=await inspectGGUF(new Blob([gguf({arch:'lfm2',tensorType:2,elements:128})]));
 assert.equal(info.tensorExtentsChecked,true);assert.equal(eligibleTextEngine(info).id,'wllama-lfm2');
});
test('LFM3 Q8_0 uses verified extents and selects an LFM3-sized context for its app-owned adapter',async()=>{
 const bytes=gguf({arch:'lfm3',tensorType:8,elements:128,contextLength:262144}),info=await inspectGGUF(new Blob([bytes]));
 assert.equal(info.tensorExtentsChecked,true);assert.deepEqual(info.tensorTypes,[8]);assert.equal(eligibleTextEngine(info)?.id,'wllama-lfm3');
 const model=await inspectLocalModel(new Blob([bytes]));assert.equal(model.engine,'wllama-lfm3');assert.equal(model.contextTokens,8192);assert.deepEqual(model.inspection.tensorTypes,[8]);
 await assert.rejects(inspectGGUF(new Blob([gguf({arch:'lfm3',tensorType:8,elements:127})])),/Q8_0 block shape/);
 await assert.rejects(inspectGGUF(new Blob([bytes.subarray(0,info.dataOffset+1)])),/GGUF/);
});
test('known tensor byte extents reject truncated payload, not just out-of-file starting offsets',async()=>{
 for(const [tensorType,elements] of [[0,128],[143,128],[142,128],[42,128],[2,128],[14,256]]){const bytes=gguf({tensorType,elements}),info=await inspectGGUF(new Blob([bytes]));await assert.equal(info.tensorExtentsChecked,true);await assert.rejects(inspectGGUF(new Blob([bytes.subarray(0,info.dataOffset+1)])),/GGUF/);}
});

test('Qwen3.5 and Qwen3 select separate adapters only for their audited packings',async()=>{
 for(const tensorType of [42,142]){const blob=new Blob([gguf({tensorType})]),info=await inspectGGUF(blob);assert.equal(info.tensorExtentsChecked,true);assert.equal(eligibleTextEngine(info)?.id,'webml-qwen35');const registered=await inspectLocalModel(blob);assert.equal(registered.engine,'webml-qwen35');assert.deepEqual(registered.inspection.tensorTypes,[tensorType]);const other=await inspectGGUF(new Blob([gguf({arch:'qwen3',tensorType})]));assert.equal(eligibleTextEngine(other)?.id,tensorType===42?'wllama-qwen3':undefined);}
 await assert.rejects(inspectGGUF(new Blob([gguf({tensorType:142,elements:96})])),/PQ2_0/);
});
test('official Q2_0 group-64 offsets fit while the legacy group-128 layout is refused',async()=>{
 const current=await inspectGGUF(new Blob([q2Pair(576)]));
 assert.equal(current.tensorExtentsChecked,true);assert.deepEqual(current.tensorTypes,[42]);
 await assert.rejects(inspectGGUF(new Blob([q2Pair(544)])),/Q2_0 tensor layout conflicts with official group-64 blocks/);
 const legacy=new Blob([q2Pair(544)]);let reads=0;
 await assert.rejects(inspectLocalModel({size:legacy.size,slice(start,end){reads++;return legacy.slice(start,end);},stream(){throw Error('Legacy Q2_0 must not be hashed');}}),/Q2_0 tensor layout conflicts with official group-64 blocks/);
 assert.equal(reads,1);
});
