import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {decisionManifest,decisionFile,readDecisionFile,prepareDecisionFile,inspectCustomDecisionModel,importCustomDecisionModel,readCustomDecisionFile,decisionModelDescriptor} from '../src/decision-assets.ts';
const bytes=new TextEncoder().encode(fs.readFileSync(new URL('../src/decision-manifest.json',import.meta.url),'utf8'));
const config=new TextEncoder().encode('{\n  "backend": "tokenizers",\n  "bos_token": "<|startoftext|>",\n  "eos_token": "<|im_end|>",\n  "pad_token": "<|pad|>",\n  "mask_token": "<|mask|>",\n  "clean_up_tokenization_spaces": false,\n  "model_max_length": 16384,\n  "tokenizer_class": "TokenizersBackend"\n}\n');
const fixture=(cached,controller,abortReading=false)=>{
 const events=[];
 const file={size:cached?.length??0,stream(){let i=0;return new ReadableStream({pull(c){if(i>=cached.length){c.close();return;}c.enqueue(cached.slice(i,i+20));i+=20;if(abortReading)controller.abort();},cancel(){events.push('reader cancelled');}});}};
 const directory={async getFileHandle(name,options){
  if(options?.create){events.push('writer opened');return {async createWritable(){return {async write(value){events.push(['write',value.length]);},async close(){events.push('committed');},async abort(){events.push('writer aborted');}};}};}
  if(!cached)throw Error('Missing');return {async getFile(){return file;}};
 }};
 const io={directory:async()=>directory,fetch:async()=>{events.push('fetch');return new Response(config);}};return {events,io};
};
test('decision assets pin approved model/conversion/runtime independently and reject unknown asset paths',()=>{
 assert.equal(decisionManifest.id,'d1-omni-600M');assert.equal(decisionManifest.conversion.dtype,'q8');assert.equal(decisionManifest.source.license,'LFM-Open-1.0');assert.equal(decisionManifest.runtime.license,'MIT');assert.equal(decisionFile('../model.onnx'),undefined);assert.equal(decisionFile('https://example.test/'),undefined);assert.ok(decisionManifest.files.every(f=>f.url.includes('/'+decisionManifest.conversion.revision+'/')&&/^[a-f0-9]{64}$/.test(f.sha256)));assert.ok(bytes.length);
});
test('cached-file Stop never opens a replacement writer or fetch, and readers release',async()=>{
 const controller=new AbortController(),f=fixture(config,controller,true);await assert.rejects(prepareDecisionFile('tokenizer_config.json',true,controller.signal,()=>{},f.io),/Stopped|abort/i);assert.ok(f.events.includes('reader cancelled'));assert.ok(!f.events.includes('writer opened')&&!f.events.includes('fetch'));
});
test('missing/corrupt runtime reads cannot repair/download; explicit preparation verifies before committing and aborts invalid bytes',async()=>{
 const controller=new AbortController(),valid=fixture(config,controller);await readDecisionFile('tokenizer_config.json',controller.signal,()=>{},valid.io);assert.ok(!valid.events.includes('fetch'));
 const missing=fixture(undefined,controller);await assert.rejects(readDecisionFile('tokenizer_config.json',controller.signal,()=>{},missing.io));await assert.rejects(prepareDecisionFile('tokenizer_config.json',false,controller.signal,()=>{},missing.io),/Downloads/);assert.ok(!missing.events.includes('fetch'));
 const prepared=fixture(undefined,controller);await prepareDecisionFile('tokenizer_config.json',true,controller.signal,()=>{},prepared.io);assert.ok(prepared.events.includes('committed'));
 const corrupt=fixture(undefined,controller);corrupt.io.fetch=async()=>new Response('wrong');await assert.rejects(prepareDecisionFile('tokenizer_config.json',true,controller.signal,()=>{},corrupt.io),/verification/i);assert.ok(corrupt.events.includes('writer aborted'));assert.ok(!corrupt.events.includes('committed'));
});


test('storage writer failure cancels the acquired download instead of leaving a background stream running',async()=>{
 const controller=new AbortController();let cancelled=false;
 const io={fetch:async()=>new Response(new ReadableStream({cancel(){cancelled=true;}})),directory:async()=>({async getFileHandle(name,options){if(!options?.create)throw Error('Missing');return {async createWritable(){throw Error('Disk full');}};}})};
 await assert.rejects(prepareDecisionFile('tokenizer_config.json',true,controller.signal,()=>{},io),/Disk full/);assert.equal(cancelled,true);
});

test('isolated decision WebGPU entry uses its matching native asyncify bridge, with exact installed hashes',()=>{
 const worker=fs.readFileSync(new URL('../src/decision-worker.ts',import.meta.url),'utf8');assert.ok(worker.includes('ort-wasm-simd-threaded.asyncify.wasm?url'));assert.ok(worker.includes('ort-wasm-simd-threaded.asyncify.mjs?url'));assert.ok(!worker.includes('ort-wasm-simd-threaded.jsep'));
 for(const pin of decisionManifest.runtime.files){const data=fs.readFileSync(new URL('../node_modules/onnxruntime-web-d1/'+pin.path,import.meta.url));assert.equal(data.length,pin.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),pin.sha256);}
 const bridge=fs.readFileSync(new URL('../node_modules/onnxruntime-web-d1/dist/ort-wasm-simd-threaded.asyncify.mjs',import.meta.url),'utf8');assert.ok(bridge.includes('webgpuInit'));
});

test('large cached verification yields to a pending Stop message before another chunk is hashed',async()=>{
 const controller=new AbortController(),pin=decisionFile('onnx/model_quantized.onnx_data');let reads=0,cancelled=false;
 const file={size:pin.bytes,stream(){return new ReadableStream({pull(c){reads++;if(reads>2)c.close();else c.enqueue(new Uint8Array(9_000_000));},cancel(){cancelled=true;}});}};
 const io={directory:async()=>({getFileHandle:async()=>({getFile:async()=>file})}),fetch:async()=>{throw Error('Unexpected fetch');}};
 setTimeout(()=>controller.abort(),0);await assert.rejects(readDecisionFile(pin.path,controller.signal,()=>{},io),/Stopped/);assert.ok(cancelled);assert.ok(reads<=3);
});

test('custom D1 files require the fixed text graph and stay local, content-addressed and verified',async()=>{
 const files=[new File([JSON.stringify({model_type:'d1_omni',max_length:16384,_name_or_path:'Personal D1'})],'config.json'),new File(['{}'],'tokenizer.json'),new File(['{}'],'tokenizer_config.json'),new File([new Uint8Array([1,2,3])],'model_quantized.onnx'),new File([new Uint8Array([4,5,6])],'model_quantized.onnx_data')];
 const review=await inspectCustomDecisionModel(files);assert.equal(review.model.role,'decision');assert.equal(review.model.engine,'onnx-d1-text');assert.equal(review.model.label,'Personal D1');assert.equal(review.model.inspection.scope,'text-only');assert.equal(review.model.files.length,5);
 const memory=new Map(),events=[],io={fetch:async()=>{events.push('network');throw Error('Unexpected network');},directory:async()=>({async getFileHandle(key,options){if(!options?.create){const file=memory.get(key);if(!file)throw Error('Missing');return {getFile:async()=>file};}return {createWritable:async()=>{const chunks=[];return {write:async chunk=>chunks.push(chunk),close:async()=>memory.set(key,new File(chunks,key)),abort:async()=>events.push('abort')};}};}})};
 const stored=await importCustomDecisionModel(review,new AbortController().signal,()=>{},io);assert.deepEqual(stored,review.model);assert.equal(memory.size,new Set(stored.files.map(pin=>pin.sha256)).size);for(const pin of stored.files){const read=await readCustomDecisionFile(stored,pin.path,new AbortController().signal,()=>{},io);assert.equal(read.size,pin.bytes);}assert.ok(!events.includes('network'));
 await assert.rejects(inspectCustomDecisionModel([...files.slice(0,4),new File([new Uint8Array([9])],'arbitrary.onnx_data')]),/unsupported|missing/i);
 await assert.rejects(inspectCustomDecisionModel([new File([JSON.stringify({model_type:'other',max_length:16384})],'config.json'),...files.slice(1)]),/compatible/i);
});
test('decision descriptors pin built-in and custom models to their own local revision and role',()=>{
 const builtin=decisionModelDescriptor(decisionManifest.id);assert.equal(builtin.id,decisionManifest.id);assert.equal(builtin.revision,decisionManifest.conversion.revision);assert.equal(builtin.custom,false);
 const files=[{path:'config.json',bytes:1,sha256:'1'.repeat(64)},{path:'tokenizer.json',bytes:1,sha256:'2'.repeat(64)},{path:'tokenizer_config.json',bytes:1,sha256:'3'.repeat(64)},{path:'onnx/model_quantized.onnx',bytes:1,sha256:'4'.repeat(64)},{path:'onnx/model_quantized.onnx_data',bytes:1,sha256:'5'.repeat(64)}];const model={id:'local-decision-'+createHash('sha256').update(JSON.stringify(files)).digest('hex'),label:'Custom',role:'decision',engine:'onnx-d1-text',revision:'sha256:'+createHash('sha256').update(JSON.stringify(files)).digest('hex'),files,inspection:{format:'D1-ONNX',architecture:'d1_omni',contextTokens:16384,inputLimit:2048,scope:'text-only'}};
 const custom=decisionModelDescriptor(model);assert.equal(custom.id,model.id);assert.equal(custom.revision,model.revision);assert.equal(custom.custom,true);assert.equal(custom.inputLimit,2048);assert.deepEqual(custom.files,files);
 assert.throws(()=>decisionModelDescriptor('d1-3B'),/not connected/i);
});
