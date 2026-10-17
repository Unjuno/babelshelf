import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectGGUF} from '../dist/gguf-inspect.js';
import {localEngine,eligibleTextEngine} from '../dist/local-engines.js';

const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
const u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;};
const str=s=>Buffer.concat([u64(Buffer.byteLength(s)),Buffer.from(s)]);
function gguf({arch='qwen35',tensorType=143,duplicate=false}={}){
 const entries=[['general.architecture',8,str(arch)],['general.name',8,str('User 日本語')],['qwen35.context_length',4,u32(4096)],['tokenizer.ggml.model',8,str('gpt2')],['tokenizer.chat_template',8,str('{{ messages }}')],['tokenizer.ggml.tokens',9,Buffer.concat([u32(8),u64(2),str('a'),str('b')])]];
 if(duplicate)entries.push(entries[0]);
 const h=Buffer.concat([Buffer.from('GGUF'),u32(3),u64(1),u64(entries.length),...entries.map(([k,t,v])=>Buffer.concat([str(k),u32(t),v])),str('weight'),u32(1),u64(128),u32(tensorType),u64(0)]);
 const padding=(32-h.length%32)%32;return Buffer.concat([h,Buffer.alloc(padding),Buffer.alloc(512)]);
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
test('known tensor byte extents reject truncated payload, not just out-of-file starting offsets',async()=>{
 for(const tensorType of [0,143]){const bytes=gguf({tensorType}),info=await inspectGGUF(new Blob([bytes]));await assert.rejects(inspectGGUF(new Blob([bytes.subarray(0,info.dataOffset+1)])),/GGUF/);}
});
