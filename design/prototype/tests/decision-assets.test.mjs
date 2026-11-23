import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {decisionManifest,decisionFile,readDecisionFile,prepareDecisionFile,prepareDecision,inspectCustomDecisionModel,importCustomDecisionModel,readCustomDecisionFile,decisionModelDescriptor,createDecisionAssetStore} from '../src/decision-assets.ts';
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

test('selected built-in Decision files import offline only after exact pin verification',async()=>{
 const controller=new AbortController(),valid=fixture(undefined,controller),file=new File([config],'tokenizer_config.json');
 await prepareDecisionFile('tokenizer_config.json',false,controller.signal,()=>{},valid.io,file);
 assert.ok(valid.events.includes('committed'));assert.ok(!valid.events.includes('fetch'));
 const corrupt=fixture(undefined,controller);
 await assert.rejects(prepareDecisionFile('tokenizer_config.json',false,controller.signal,()=>{},corrupt.io,new File([new Uint8Array(config.length).fill(7)],'tokenizer_config.json')),/verification/i);
 assert.ok(corrupt.events.includes('writer aborted'));assert.ok(!corrupt.events.includes('committed')&&!corrupt.events.includes('fetch'));
 await assert.rejects(prepareDecision(false,controller.signal,()=>{},async()=>{throw Error('Network used');},decisionManifest.id,[new File(['x'],'arbitrary.json')]),/Unknown or duplicate Decision file/);
});


test('storage writer failure cancels the acquired download instead of leaving a background stream running',async()=>{
 const controller=new AbortController();let cancelled=false;
 const io={fetch:async()=>new Response(new ReadableStream({cancel(){cancelled=true;}})),directory:async()=>({async getFileHandle(name,options){if(!options?.create)throw Error('Missing');return {async createWritable(){throw Error('Disk full');}};}})};
 await assert.rejects(prepareDecisionFile('tokenizer_config.json',true,controller.signal,()=>{},io),/Disk full/);assert.equal(cancelled,true);
});

test('built-in Decision asset preparation resumes from the last verified range after a network interruption',async()=>{
 const rangeBytes=16*1024*1024,all=new Uint8Array(rangeBytes+37);for(let i=0;i<all.length;i++)all[i]=i%251;
 const digest=createHash('sha256').update(all).digest('hex'),files=new Map(),ranges=[];
 const handle={async getFile(){return files.get(digest)??new Blob([]);},async createWritable(){let data=new Uint8Array(await (files.get(digest)??new Blob([])).arrayBuffer()),position=0;return {async seek(value){position=value;},async truncate(value){data=data.slice(0,value);position=Math.min(position,value);},async write(value){const chunk=new Uint8Array(value),next=new Uint8Array(Math.max(data.length,position+chunk.length));next.set(data);next.set(chunk,position);data=next;position+=chunk.length;},async close(){files.set(digest,new Blob([data]));},async abort(){}};}};
 const directory={async getFileHandle(name,{create=false}={}){assert.equal(name,digest);if(!create&&!files.has(name))throw new DOMException('missing','NotFoundError');return handle;}};
 let interrupted=false;const fetch=async(_url,options)=>{const match=/bytes=(\d+)-(\d+)/.exec(options.headers.Range),start=Number(match[1]),end=Number(match[2]);ranges.push(options.headers.Range);const headers={'content-range':`bytes ${start}-${end}/${all.length}`,'content-length':String(end-start+1)};
  if(start===rangeBytes&&!interrupted){interrupted=true;let sent=false;return new Response(new ReadableStream({pull(controller){if(!sent){sent=true;controller.enqueue(all.subarray(start,start+5));}else controller.error(new TypeError('connection reset'));}}),{status:206,headers});}
  return new Response(all.subarray(start,end+1),{status:206,headers});
 };
 const store=createDecisionAssetStore({directory:async()=>directory,fetch},{id:'d1-omni-600M',conversion:{revision:'a'.repeat(40)},runtime:{revision:'decision-runtime-test'},files:[{path:'onnx/model_quantized.onnx_data',url:'https://huggingface.co/test/resolve/'+ 'a'.repeat(40)+'/onnx/model_quantized.onnx_data',bytes:all.length,sha256:digest}]}),signal=new AbortController().signal;
 await assert.rejects(store.prepare(true,signal),/connection reset/);assert.equal(files.get(digest).size,rangeBytes);
 const resumed=await store.prepare(true,signal);assert.equal(resumed.downloadedBytes,37);assert.deepEqual(ranges,[`bytes=0-${rangeBytes-1}`,`bytes=${rangeBytes}-${all.length-1}`,`bytes=${rangeBytes}-${all.length-1}`]);
 assert.equal((await store.status(signal)).filesPresent,true);assert.deepEqual(new Uint8Array(await(await store.read('onnx/model_quantized.onnx_data',signal)).arrayBuffer()),all);
});

test('Decision pins the full JSEP runtime required by D1 GatherBlockQuantized',()=>{
 const worker=fs.readFileSync(new URL('../src/decision-worker.ts',import.meta.url),'utf8');assert.ok(worker.includes("from 'onnxruntime-web'"));assert.ok(worker.includes('ort-wasm-simd-threaded.jsep.wasm?url'));assert.ok(worker.includes('ort-wasm-simd-threaded.jsep.mjs?url'));assert.ok(worker.includes("ort.env.webgpu.powerPreference='high-performance'"));assert.ok(worker.includes('probeDecisionWebGPU(gpu,8000,controller!.signal)'),'Decision adapter preflight must be bounded and cancellable');assert.ok(!worker.includes('gpu.requestAdapter({powerPreference:\'high-performance\'})'));assert.ok(!worker.includes('ort.env.wasm.numThreads=1'),'CPU/WASM fallback must retain ONNX Runtime automatic thread selection');
 for(const pin of decisionManifest.runtime.files){const data=fs.readFileSync(new URL('../node_modules/onnxruntime-web/'+pin.path,import.meta.url));assert.equal(data.length,pin.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),pin.sha256);}
 const runtime=fs.readFileSync(new URL('../node_modules/onnxruntime-web/dist/ort.bundle.min.mjs',import.meta.url),'utf8');assert.ok(runtime.includes('GatherBlockQuantized'),'pinned Decision runtime must include the required quantized gather operator');
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
