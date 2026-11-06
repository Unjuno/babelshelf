import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {hashLocalModel,localSpeechModelId,validateLocalModel,localTextContextOptions} from '../dist/local-models.js';
import {eligibleTextEngine} from '../dist/local-engines.js';

const digest='a'.repeat(64);
const record=()=>({id:'local-'+digest,label:'My model',role:'text',engine:'webml-qwen35',revision:'sha256:'+digest,file:{bytes:1000,sha256:digest},contextTokens:2048,inspection:{format:'GGUF',version:3,bytes:1000,name:'My model',architecture:'qwen35',contextLength:4096,tokenizer:'gpt2',chatTemplate:true,tokenCount:1024,tensorCount:1,tensorTypes:[143],tensorExtentsChecked:true,dataOffset:512}});
const decisionRecord=()=>{const files=[{path:'config.json',bytes:1000,sha256:'1'.repeat(64)},{path:'tokenizer.json',bytes:1000,sha256:'2'.repeat(64)},{path:'tokenizer_config.json',bytes:1000,sha256:'3'.repeat(64)},{path:'onnx/model_quantized.onnx',bytes:1000,sha256:'4'.repeat(64)},{path:'onnx/model_quantized.onnx_data',bytes:1000,sha256:'5'.repeat(64)}],idDigest=createHash('sha256').update(JSON.stringify(files)).digest('hex');return {id:'local-decision-'+idDigest,label:'Fine-tuned D1',role:'decision',engine:'onnx-d1-text',revision:'sha256:'+idDigest,files,inspection:{format:'D1-ONNX',architecture:'d1_omni',contextTokens:16384,inputLimit:2048,scope:'text-only'}};};
const speechRecord=()=>{const files=['config.json','generation_config.json','preprocessor_config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','onnx/encoder_model_quantized.onnx','onnx/decoder_model_merged_quantized.onnx'].map((path,i)=>({path,bytes:1000,sha256:String(i+1).repeat(64)})),digest=createHash('sha256').update(JSON.stringify(files)).digest('hex');return {id:'local-speech-'+digest,label:'Fine-tuned Whisper',role:'speech',engine:'transformers-whisper-onnx',revision:'sha256:'+digest,files,inspection:{format:'Whisper-ONNX',architecture:'whisper',device:'wasm',dtype:'q8',maxDurationSeconds:120}};};
test('custom model records are strict declarative identity, never runtime code or readiness',()=>{
 const value=record();assert.deepEqual(validateLocalModel(value),value);
 for(const change of [r=>r.engine='remote',r=>r.role='decision',r=>r.id='4B',r=>r.file.url='https://example.com/weights',r=>r.runtime='script.js',r=>r.ready=true,r=>r.inspection.architecture='llama',r=>r.file.bytes=999,r=>r.inspection.tensorTypes=[143,143],r=>r.label='bad\0name']){const r=record();change(r);assert.throws(()=>validateLocalModel(r),/model/i);}
});
test('custom text context is an explicit bounded choice, defaults legacy records safely, and cannot exceed inspected capacity',()=>{
 assert.deepEqual(localTextContextOptions(32768),[2048,4096,8192,16384,32768]);assert.deepEqual(localTextContextOptions(16384),[2048,4096,8192,16384]);assert.deepEqual(localTextContextOptions(4096),[2048,4096]);
 assert.deepEqual(localTextContextOptions(262144,'wllama-lfm3'),[2048,4096,8192,16384,32768,65536,131072,262144]);assert.deepEqual(localTextContextOptions(262144,'wllama-lfm2'),[2048,4096,8192,16384,32768]);
 const old=record();delete old.contextTokens;assert.equal(validateLocalModel(old).contextTokens,2048);
 const larger=record();larger.engine='wllama-lfm2';larger.inspection.architecture='lfm2';larger.inspection.tensorTypes=[0,2,14];larger.inspection.tensorCount=3;larger.contextTokens=4096;assert.equal(validateLocalModel(larger).contextTokens,4096);
 for(const invalid of [3000,8192,2048.5]){const bad=structuredClone(larger);bad.contextTokens=invalid;assert.throws(()=>validateLocalModel(bad),/model/i);}
 const lfm3=record();lfm3.engine='wllama-lfm3';lfm3.inspection.architecture='lfm3';lfm3.inspection.contextLength=262144;lfm3.inspection.tensorTypes=[0,2,8,14];lfm3.inspection.tensorCount=4;lfm3.contextTokens=262144;assert.equal(validateLocalModel(lfm3).contextTokens,262144);lfm3.contextTokens=524288;assert.throws(()=>validateLocalModel(lfm3),/model/i);
 const legacyLfm3=structuredClone(lfm3);delete legacyLfm3.contextTokens;assert.equal(validateLocalModel(legacyLfm3).contextTokens,8192);
});
test('LFM2 custom records must match the inspected wllama adapter contract',()=>{
 const value=record();value.engine='wllama-lfm2';value.inspection.architecture='lfm2';value.inspection.tensorTypes=[0,2,14];value.inspection.tensorCount=3;assert.deepEqual(validateLocalModel(value),value);
 for(const change of [r=>r.inspection.tokenizer='sentencepiece',r=>r.inspection.chatTemplate=false,r=>r.inspection.tensorTypes=[0,2,143],r=>r.inspection.tensorExtentsChecked=false]){const bad=record();bad.engine='wllama-lfm2';bad.inspection.architecture='lfm2';bad.inspection.tensorTypes=[0,2,14];bad.inspection.tensorCount=3;change(bad);assert.throws(()=>validateLocalModel(bad),/model/i);}
});
test('pinned LFM3 QAD GGUF metadata selects only the dedicated LFM3 app adapter',()=>{
 const inspection={format:'GGUF',version:3,bytes:1049615680,name:'LFM3 1.7B QAD',architecture:'lfm3',contextLength:262144,tokenizer:'gpt2',chatTemplate:true,tokenCount:128000,tensorCount:287,tensorTypes:[0,2,14],tensorExtentsChecked:true,dataOffset:8247360};
 assert.equal(eligibleTextEngine(inspection)?.id,'wllama-lfm3');
 const value=record();value.file.bytes=inspection.bytes;value.inspection=inspection;value.engine='wllama-lfm3';assert.deepEqual(validateLocalModel(value),value);
 const q8=structuredClone(value);q8.inspection.tensorTypes=[8];assert.equal(validateLocalModel(q8).engine,'wllama-lfm3');
 for(const change of [r=>r.inspection.tensorTypes=[0,2,143],r=>r.inspection.tokenizer='sentencepiece',r=>r.inspection.chatTemplate=false,r=>r.inspection.tensorExtentsChecked=false]){const bad=structuredClone(value);change(bad);assert.throws(()=>validateLocalModel(bad),/model/i);}
});
test('Qwen3 CPU custom identity admits audited packings but excludes private and ambiguous layouts',()=>{
 const value=record();value.engine='wllama-qwen3';value.inspection.architecture='qwen3';value.inspection.tensorTypes=[0,2,42];value.inspection.tensorCount=3;assert.deepEqual(validateLocalModel(value),value);
 for(const change of [r=>r.inspection.tensorTypes=[0,142],r=>r.inspection.tensorTypes=[0,143],r=>r.inspection.tensorExtentsChecked=false,r=>r.engine='webml-qwen35',r=>r.inspection.architecture='qwen35']){const bad=structuredClone(value);change(bad);assert.throws(()=>validateLocalModel(bad),/model/i);}
});
test('custom decision records bind only the fixed app-owned D1 text graph assets',()=>{
 const value=decisionRecord();assert.deepEqual(validateLocalModel(value),value);
 for(const change of [r=>r.engine='remote',r=>r.inspection.architecture='llama',r=>r.inspection.scope='multimodal',r=>r.files.pop(),r=>r.files[4].path='onnx/arbitrary.onnx',r=>r.files.push({path:'script.js',bytes:10,sha256:'6'.repeat(64)}),r=>r.files[0].sha256='bad',r=>r.runtime='custom.js',r=>r.ready=true]){const bad=decisionRecord();change(bad);assert.throws(()=>validateLocalModel(bad),/model/i);}
});
test('custom speech records bind the fixed local Whisper ONNX adapter and exact package files',()=>{
 const value=speechRecord();assert.equal(localSpeechModelId(value.files),value.id);assert.deepEqual(validateLocalModel(value),value);
 for(const change of [r=>r.engine='remote',r=>r.inspection.architecture='wav2vec',r=>r.inspection.device='webgpu',r=>r.inspection.maxDurationSeconds=3600,r=>r.files.pop(),r=>r.files[6].path='onnx/arbitrary.onnx',r=>r.files.push({path:'model.py',bytes:10,sha256:'9'.repeat(64)}),r=>r.files[0].sha256='bad',r=>r.runtime='custom.js',r=>r.ready=true]){const bad=speechRecord();change(bad);assert.throws(()=>validateLocalModel(bad),/model/i);}
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

test('custom text model can retain a validated public Hugging Face source pin',()=>{
 const value=record();value.source={provider:'huggingface',repo:'publisher/model-name',revision:'b'.repeat(40),file:'model-q4.gguf',license:'apache-2.0'};
 assert.deepEqual(validateLocalModel(value),value);
 for(const change of [r=>r.source.provider='other',r=>r.source.repo='https://example.com/model',r=>r.source.revision='main',r=>r.source.file='../weights.gguf',r=>r.source.license='x'.repeat(101)]){const bad=record();bad.source={provider:'huggingface',repo:'publisher/model-name',revision:'b'.repeat(40),file:'model-q4.gguf',license:'apache-2.0'};change(bad);assert.throws(()=>validateLocalModel(bad),/model/i);}
});
