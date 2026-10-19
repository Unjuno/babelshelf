import {SHA256} from './sha256.js';
import {inspectGGUF} from './gguf-inspect.js';
import {eligibleTextEngine} from './local-engines.js';

export const MAX_LOCAL_MODEL_BYTES=8*1024*1024*1024;
export const MAX_LOCAL_DECISION_BYTES=2*1024*1024*1024;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
const fail=()=>{throw Error('Invalid local model record');};
const safeText=s=>typeof s==='string'&&s.trim().length>0&&s.length<=100&&!s.includes('\0')&&!Array.from(s).some(c=>c.length===1&&c.charCodeAt(0)>=0xd800&&c.charCodeAt(0)<=0xdfff);
const decisionPaths=['config.json','tokenizer.json','tokenizer_config.json','onnx/model_quantized.onnx','onnx/model_quantized.onnx_data'];
export function localDecisionModelId(files){const pins=files.map(({path,bytes,sha256})=>({path,bytes,sha256}));return 'local-decision-'+new SHA256().update(new TextEncoder().encode(JSON.stringify(pins))).hex();}
export function validateLocalModel(value){
 if(value?.role==='decision'){
  if(!exact(value,['id','label','role','engine','revision','files','inspection'])||value.engine!=='onnx-d1-text'||!safeText(value.label)||!Array.isArray(value.files)||value.files.length!==decisionPaths.length||!exact(value.inspection,['format','architecture','contextTokens','inputLimit','scope']))fail();
  let total=0;for(const [index,file] of value.files.entries()){if(!exact(file,['path','bytes','sha256'])||file.path!==decisionPaths[index]||!Number.isSafeInteger(file.bytes)||file.bytes<1||file.bytes>MAX_LOCAL_DECISION_BYTES||typeof file.sha256!=='string'||!/^[a-f0-9]{64}$/.test(file.sha256))fail();total+=file.bytes;}
  const i=value.inspection;if(total>MAX_LOCAL_DECISION_BYTES||i.format!=='D1-ONNX'||i.architecture!=='d1_omni'||i.contextTokens!==16384||i.inputLimit!==2048||i.scope!=='text-only'||value.id!==localDecisionModelId(value.files)||value.revision!=='sha256:'+value.id.slice('local-decision-'.length))fail();
  return structuredClone(value);
 }
 if(!exact(value,['id','label','role','engine','revision','file','inspection'])||!exact(value.file,['bytes','sha256']))fail();
 const {file,inspection:i}=value;
 if(typeof file.sha256!=='string'||!/^[a-f0-9]{64}$/.test(file.sha256)||value.id!=='local-'+file.sha256||value.revision!=='sha256:'+file.sha256||!safeText(value.label)||value.role!=='text'||!Number.isSafeInteger(file.bytes)||file.bytes<24||file.bytes>MAX_LOCAL_MODEL_BYTES)fail();
 if(!exact(i,['format','version','bytes','name','architecture','contextLength','tokenizer','chatTemplate','tokenCount','tensorCount','tensorTypes','tensorExtentsChecked','dataOffset'])||i.bytes!==file.bytes||typeof i.name!=='string'||i.name.length>4096||eligibleTextEngine(i)?.id!==value.engine||!Number.isSafeInteger(i.tensorCount)||i.tensorCount<1||i.tensorCount>20000||i.tokenCount>2000000||i.tensorTypes.length>i.tensorCount||new Set(i.tensorTypes).size!==i.tensorTypes.length||i.tensorTypes.some((n,j)=>j>0&&n<=i.tensorTypes[j-1])||!Number.isSafeInteger(i.dataOffset)||i.dataOffset<24||i.dataOffset>=file.bytes)fail();
 return structuredClone(value);
}
export async function hashLocalModel(file,{signal,progress=()=>{}}={}){
 if(!Number.isSafeInteger(file?.size)||file.size<1||file.size>MAX_LOCAL_MODEL_BYTES)throw Error('Local model file size unsupported');
 signal?.throwIfAborted();const reader=file.stream().getReader(),hash=new SHA256();let bytes=0,sinceYield=0;
 let cancellation;const cancel=()=>cancellation??=reader.cancel().catch(()=>{});
 const abort=()=>{void cancel();};
 signal?.addEventListener('abort',abort,{once:true});
 try{
  while(true){
   signal?.throwIfAborted();const result=await reader.read();signal?.throwIfAborted();if(result.done)break;
   bytes+=result.value.length;if(bytes>file.size)throw Error('Local model file changed');
   for(let offset=0;offset<result.value.length;offset+=65536){
    const part=result.value.subarray(offset,offset+65536);hash.update(part);sinceYield+=part.length;
    if(sinceYield>=1048576){sinceYield=0;await new Promise(resolve=>setTimeout(resolve,0));signal?.throwIfAborted();}
   }
   progress(bytes,file.size);
  }
  if(bytes!==file.size)throw Error('Local model file changed');
  await new Promise(resolve=>setTimeout(resolve,0));signal?.throwIfAborted();return hash.hex();
 }finally{signal?.removeEventListener('abort',abort);await cancel();reader.releaseLock();}
}
export async function inspectLocalModel(file,{signal,progress,label}={}){
 const inspection=await inspectGGUF(file,{signal}),engine=eligibleTextEngine(inspection);
 if(!engine)throw Error('No compatible local engine for this GGUF');
 const sha256=await hashLocalModel(file,{signal,progress});signal?.throwIfAborted();
 return validateLocalModel({id:'local-'+sha256,label:label??(inspection.name.slice(0,100)||'Local model'),role:'text',engine:engine.id,revision:'sha256:'+sha256,file:{bytes:file.size,sha256},inspection});
}
