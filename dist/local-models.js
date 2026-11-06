import {SHA256} from './sha256.js';
import {createStreamingSHA256} from './streaming-sha256.js';
import {inspectGGUF} from './gguf-inspect.js';
import {eligibleTextEngine} from './local-engines.js';

export const MAX_LOCAL_MODEL_BYTES=8*1024*1024*1024;
export const MAX_LOCAL_DECISION_BYTES=2*1024*1024*1024;
export const MAX_LOCAL_SPEECH_BYTES=2*1024*1024*1024;
// Context is an explicit runtime choice. Larger values are not assumed to fit
// every device; the caller must expose them as higher-memory options.
export const LOCAL_TEXT_CONTEXT_OPTIONS=Object.freeze([2048,4096,8192,16384,32768]);
export const LFM3_TEXT_CONTEXT_OPTIONS=Object.freeze([...LOCAL_TEXT_CONTEXT_OPTIONS,65536,131072,262144]);
export function localTextContextOptions(contextLength,engine=''){const supported=engine==='wllama-lfm3'?LFM3_TEXT_CONTEXT_OPTIONS:LOCAL_TEXT_CONTEXT_OPTIONS;return supported.filter(size=>size<=contextLength);}
const defaultTextContext=(contextLength,engine='')=>{const choices=localTextContextOptions(contextLength,engine),target=engine==='wllama-lfm3'?8192:2048;return choices.filter(size=>size<=target).at(-1)??choices[0]??0;};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
const fail=()=>{throw Error('Invalid local model record');};
const safeText=s=>typeof s==='string'&&s.trim().length>0&&s.length<=100&&!s.includes('\0')&&!Array.from(s).some(c=>c.length===1&&c.charCodeAt(0)>=0xd800&&c.charCodeAt(0)<=0xdfff);
const decisionPaths=['config.json','tokenizer.json','tokenizer_config.json','onnx/model_quantized.onnx','onnx/model_quantized.onnx_data'];
export const localSpeechModelId=files=>'local-speech-'+new SHA256().update(new TextEncoder().encode(JSON.stringify(files.map(({path,bytes,sha256})=>({path,bytes,sha256}))))).hex();
export function localDecisionModelId(files){const pins=files.map(({path,bytes,sha256})=>({path,bytes,sha256}));return 'local-decision-'+new SHA256().update(new TextEncoder().encode(JSON.stringify(pins))).hex();}
export function validateLocalModel(value){
 if(value?.role==='speech'){
  const paths=['config.json','generation_config.json','preprocessor_config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','onnx/encoder_model_quantized.onnx','onnx/decoder_model_merged_quantized.onnx'];
  if(!exact(value,['id','label','role','engine','revision','files','inspection'])||value.engine!=='transformers-whisper-onnx'||!safeText(value.label)||!Array.isArray(value.files)||value.files.length!==paths.length||!exact(value.inspection,['format','architecture','device','dtype','maxDurationSeconds']))fail();
  let total=0;for(const [index,file] of value.files.entries()){if(!exact(file,['path','bytes','sha256'])||file.path!==paths[index]||!Number.isSafeInteger(file.bytes)||file.bytes<1||file.bytes>MAX_LOCAL_SPEECH_BYTES||typeof file.sha256!=='string'||!/^[a-f0-9]{64}$/.test(file.sha256))fail();total+=file.bytes;}
  const i=value.inspection;if(total>MAX_LOCAL_SPEECH_BYTES||i.format!=='Whisper-ONNX'||i.architecture!=='whisper'||i.device!=='wasm'||i.dtype!=='q8'||i.maxDurationSeconds!==120||value.id!==localSpeechModelId(value.files)||value.revision!=='sha256:'+value.id.slice('local-speech-'.length))fail();
  return structuredClone(value);
 }
 if(value?.role==='decision'){
  if(!exact(value,['id','label','role','engine','revision','files','inspection'])||value.engine!=='onnx-d1-text'||!safeText(value.label)||!Array.isArray(value.files)||value.files.length!==decisionPaths.length||!exact(value.inspection,['format','architecture','contextTokens','inputLimit','scope']))fail();
  let total=0;for(const [index,file] of value.files.entries()){if(!exact(file,['path','bytes','sha256'])||file.path!==decisionPaths[index]||!Number.isSafeInteger(file.bytes)||file.bytes<1||file.bytes>MAX_LOCAL_DECISION_BYTES||typeof file.sha256!=='string'||!/^[a-f0-9]{64}$/.test(file.sha256))fail();total+=file.bytes;}
  const i=value.inspection;if(total>MAX_LOCAL_DECISION_BYTES||i.format!=='D1-ONNX'||i.architecture!=='d1_omni'||i.contextTokens!==16384||i.inputLimit!==2048||i.scope!=='text-only'||value.id!==localDecisionModelId(value.files)||value.revision!=='sha256:'+value.id.slice('local-decision-'.length))fail();
  return structuredClone(value);
 }
  const hasContextTokens=Object.hasOwn(value??{},'contextTokens');const textKeys=['id','label','role','engine','revision','file','inspection'];if(hasContextTokens)textKeys.push('contextTokens');if(Object.hasOwn(value??{},'source'))textKeys.push('source');
  if(!exact(value,textKeys)||!exact(value.file,['bytes','sha256']))fail();
 const {file,inspection:i}=value;
 if(typeof file.sha256!=='string'||!/^[a-f0-9]{64}$/.test(file.sha256)||value.id!=='local-'+file.sha256||value.revision!=='sha256:'+file.sha256||!safeText(value.label)||value.role!=='text'||!Number.isSafeInteger(file.bytes)||file.bytes<24||file.bytes>MAX_LOCAL_MODEL_BYTES)fail();
  if(value.source!==undefined){const s=value.source,repoPattern=/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\/[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/,safePath=p=>typeof p==='string'&&p.length<=512&&!p.startsWith('/')&&!p.includes('\\')&&p.split('/').every(part=>!!part&&part!=='.'&&part!=='..'&&/^[A-Za-z0-9_.-]+$/.test(part));if(!exact(s,['provider','repo','revision','file','license'])||s.provider!=='huggingface'||!repoPattern.test(s.repo)||!/^[a-f0-9]{40}$/.test(s.revision)||!safePath(s.file)||s.license!==null&&(!safeText(s.license)||s.license.length>100))fail();}
 const engine=eligibleTextEngine(i);
 if(!exact(i,['format','version','bytes','name','architecture','contextLength','tokenizer','chatTemplate','tokenCount','tensorCount','tensorTypes','tensorExtentsChecked','dataOffset'])||i.bytes!==file.bytes||typeof i.name!=='string'||i.name.length>4096||engine?.id!==value.engine||!localTextContextOptions(i.contextLength,engine.id).includes(hasContextTokens?value.contextTokens:defaultTextContext(i.contextLength,engine.id))||!Number.isSafeInteger(i.tensorCount)||i.tensorCount<1||i.tensorCount>20000||i.tokenCount>2000000||i.tensorTypes.length>i.tensorCount||new Set(i.tensorTypes).size!==i.tensorTypes.length||i.tensorTypes.some((n,j)=>j>0&&n<=i.tensorTypes[j-1])||!Number.isSafeInteger(i.dataOffset)||i.dataOffset<24||i.dataOffset>=file.bytes)fail();
 return {...structuredClone(value),contextTokens:hasContextTokens?value.contextTokens:defaultTextContext(i.contextLength,engine.id)};
}
export async function hashLocalModel(file,{signal,progress=()=>{}}={}){
 if(!Number.isSafeInteger(file?.size)||file.size<1||file.size>MAX_LOCAL_MODEL_BYTES)throw Error('Local model file size unsupported');
 signal?.throwIfAborted();const reader=file.stream().getReader();let bytes=0,sinceYield=0,lastYield=performance.now();
 let cancellation;const cancel=()=>cancellation??=reader.cancel().catch(()=>{});
 const abort=()=>{void cancel();};
 signal?.addEventListener('abort',abort,{once:true});
 try{
  const hash=await createStreamingSHA256();signal?.throwIfAborted();
  while(true){
   signal?.throwIfAborted();const result=await reader.read();signal?.throwIfAborted();if(result.done)break;
   bytes+=result.value.length;if(bytes>file.size)throw Error('Local model file changed');
   for(let offset=0;offset<result.value.length;offset+=65536){
    const part=result.value.subarray(offset,offset+65536);hash.update(part);sinceYield+=part.length;
    if(sinceYield>=1048576&&(sinceYield>=4194304||performance.now()-lastYield>=8)){sinceYield=0;await new Promise(resolve=>setTimeout(resolve,0));signal?.throwIfAborted();lastYield=performance.now();}
   }
   progress(bytes,file.size);
  }
  if(bytes!==file.size)throw Error('Local model file changed');
  await new Promise(resolve=>setTimeout(resolve,0));signal?.throwIfAborted();return hash.hex();
 }finally{signal?.removeEventListener('abort',abort);await cancel();reader.releaseLock();}
}
export async function inspectLocalModel(file,{signal,progress,label}={}){
 const inspection=await inspectGGUF(file,{signal}),engine=eligibleTextEngine(inspection);
 if(!engine){
  if(inspection.architecture==='qwen3'&&inspection.tensorTypes.includes(42))throw Error('Qwen3 Q2_0 GGUF cannot run here · no compatible Qwen3 browser engine is installed');
  if(inspection.architecture==='qwen3'&&inspection.tensorTypes.includes(142))throw Error('Qwen3 PQ2_0 GGUF cannot run here · no compatible Qwen3 browser engine is installed');
  throw Error('No compatible local engine for this GGUF');
 }
 const sha256=await hashLocalModel(file,{signal,progress});signal?.throwIfAborted();
 return validateLocalModel({id:'local-'+sha256,label:label??(inspection.name.slice(0,100)||'Local model'),role:'text',engine:engine.id,revision:'sha256:'+sha256,file:{bytes:file.size,sha256},contextTokens:defaultTextContext(inspection.contextLength,engine.id),inspection});
}
