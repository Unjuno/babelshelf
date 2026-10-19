import {validateLocalModel,hashLocalModel} from './local-models.js';
import {inspectGGUF} from './gguf-inspect.js';
export function withLocalModels(base,records=[]){
 if(!Array.isArray(records)||records.length>64)throw Error('Invalid local model registry');
 const checked=records.map(validateLocalModel),ids=new Set(base.models.map(m=>m.id));
 const custom=checked.filter(record=>record.engine==='webml-qwen35').map(record=>{
  if(ids.has(record.id))throw Error('Duplicate local model');ids.add(record.id);
  return {id:record.id,name:record.label,revision:record.revision,format:'GGUF',file:{name:record.file.sha256+'.gguf',bytes:record.file.bytes,sha256:record.file.sha256},tokenizer:'GGUF metadata',chatTemplate:'GGUF tokenizer.chat_template metadata',mmproj:null,generationVerified:false,localModel:record};
 });
 return {...structuredClone(base),models:[...structuredClone(base.models),...custom]};
}
export async function verifyLocalModelFile(file,record,options={}){
 const checked=validateLocalModel(record);
 if(file?.size!==checked.file.bytes)throw Error('Local model verification failed');
 const actual=await inspectGGUF(file,options);
 if(Object.keys(checked.inspection).some(key=>JSON.stringify(actual[key])!==JSON.stringify(checked.inspection[key])))throw Error('Local model metadata verification failed');
 if(await hashLocalModel(file,options)!==checked.file.sha256)throw Error('Local model hash verification failed');
 options.signal?.throwIfAborted();return checked;
}
