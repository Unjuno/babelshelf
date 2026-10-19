import manifest from './decision-manifest.json' with {type:'json'};
// @ts-expect-error Shared verified streaming hash implementation is JavaScript.
import {SHA256} from '../../../dist/sha256.js';
// @ts-expect-error Shared strict local model record and cancellable hash functions are JavaScript.
import {MAX_LOCAL_DECISION_BYTES,hashLocalModel,localDecisionModelId,validateLocalModel} from '../../../dist/local-models.js';
import type {CustomDecisionModel} from './preference-records.ts';
export const decisionManifest=manifest;
type Pin=typeof manifest.files[number];
export type DecisionModelDescriptor={id:string;revision:string;inputLimit:number;contextTokens:number;scope:'text-only';custom:boolean;files:readonly {path:string;bytes:number;sha256:string}[]};
export function decisionModelDescriptor(value:string|CustomDecisionModel):DecisionModelDescriptor{
 if(value===manifest.id)return {id:manifest.id,revision:manifest.conversion.revision,inputLimit:manifest.inputLimit,contextTokens:manifest.contextTokens,scope:'text-only',custom:false,files:manifest.files.filter(f=>f.path!=='LICENSE').map(f=>({path:f.path,bytes:f.bytes,sha256:f.sha256}))};
 if(typeof value==='object'){
  const model=validateLocalModel(value) as CustomDecisionModel;if(model.role!=='decision'||model.engine!=='onnx-d1-text')throw Error('Decision runtime not connected');
  return {id:model.id,revision:model.revision,inputLimit:model.inspection.inputLimit,contextTokens:model.inspection.contextTokens,scope:'text-only',custom:true,files:model.files.map(f=>({path:f.path,bytes:f.bytes,sha256:f.sha256}))};
 }
 throw Error('Decision model runtime not connected');
}
type IO={directory:()=>Promise<FileSystemDirectoryHandle>;fetch:typeof globalThis.fetch};
const localDirectory=async()=>(await navigator.storage.getDirectory()).getDirectoryHandle('babelshelf-decision-v1',{create:true});
const ioDefault:IO={directory:localDirectory,fetch:(...args)=>globalThis.fetch(...args)};
const check=(signal:AbortSignal)=>{if(signal.aborted)throw Error('Stopped');};
const customPaths=['config.json','tokenizer.json','tokenizer_config.json','onnx/model_quantized.onnx','onnx/model_quantized.onnx_data'] as const;
type CustomReview={model:CustomDecisionModel;files:File[]};
function customPath(file:File){return file.name==='config.json'?'config.json':file.name==='tokenizer.json'?'tokenizer.json':file.name==='tokenizer_config.json'?'tokenizer_config.json':file.name==='model_quantized.onnx'?'onnx/model_quantized.onnx':file.name==='model_quantized.onnx_data'?'onnx/model_quantized.onnx_data':undefined;}
async function parseBoundedJson(file:File,maxBytes:number,signal:AbortSignal){check(signal);if(file.size<2||file.size>maxBytes)throw Error('Decision model metadata size unsupported');const value=JSON.parse(await file.text());check(signal);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Decision model metadata invalid');return value;}
export async function inspectCustomDecisionModel(files:File[],options:{signal?:AbortSignal;progress?:(text:string)=>void}={}):Promise<CustomReview>{
 const signal=options.signal??new AbortController().signal,progress=options.progress??(()=>{});check(signal);if(!Array.isArray(files)||files.length!==customPaths.length)throw Error('Choose the five D1 text model files');
 const mapped=new Map<string,File>();let total=0;for(const file of files){const path=customPath(file);if(!path||mapped.has(path)||!Number.isSafeInteger(file.size)||file.size<1)throw Error('Unsupported or duplicate Decision model file');mapped.set(path,file);total+=file.size;}if(customPaths.some(path=>!mapped.has(path))||total>MAX_LOCAL_DECISION_BYTES)throw Error('Decision model file set unsupported');
 const config=await parseBoundedJson(mapped.get('config.json')!,1024*1024,signal);if(config.model_type!=='d1_omni'||config.max_length!==decisionManifest.contextTokens)throw Error('No compatible local D1 text adapter');
 await parseBoundedJson(mapped.get('tokenizer_config.json')!,1024*1024,signal);await parseBoundedJson(mapped.get('tokenizer.json')!,32*1024*1024,signal);
 const pins=[] as CustomDecisionModel['files'];for(const [i,path] of customPaths.entries()){check(signal);const file=mapped.get(path)!;const sha256=await hashLocalModel(file,{signal,progress:(n:number,size:number)=>progress('Checking · '+(i+1)+' / '+customPaths.length+' · '+Math.round(n/size*100)+'%')});pins.push({path,bytes:file.size,sha256});}
 check(signal);const id=localDecisionModelId(pins),configName=[config._name_or_path,config.model_name,config.name].find(value=>typeof value==='string'&&value.trim()),label=typeof configName==='string'?configName.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,100)||'Custom D1':'Custom D1',model=validateLocalModel({id,label,role:'decision',engine:'onnx-d1-text',revision:'sha256:'+id.slice('local-decision-'.length),files:pins,inspection:{format:'D1-ONNX',architecture:'d1_omni',contextTokens:16384,inputLimit:decisionManifest.inputLimit,scope:'text-only'}}) as CustomDecisionModel;
 return {model,files:customPaths.map(path=>mapped.get(path)!)};
}
async function writeCustomDecisionFile(file:File,pin:CustomDecisionModel['files'][number],signal:AbortSignal,progress:(text:string)=>void,io:IO){
 check(signal);if(file.size!==pin.bytes)throw Error('Decision asset verification failed');const reader=file.stream().getReader(),hash=new SHA256();let count=0,last=Date.now(),writer:FileSystemWritableFileStream|undefined;
 try{const directory=await io.directory();check(signal);const handle=await directory.getFileHandle(pin.sha256,{create:true});check(signal);writer=await handle.createWritable();for(;;){check(signal);const {value,done}=await reader.read();check(signal);if(done)break;count+=value.length;if(count>pin.bytes)throw Error('Decision asset verification failed');hash.update(value);await writer.write(value);if(Date.now()-last>250){progress('Saving · '+Math.round(count/pin.bytes*100)+'%');last=Date.now();}}check(signal);if(count!==pin.bytes||hash.hex()!==pin.sha256)throw Error('Decision asset verification failed');await writer.close();check(signal);}
 catch(e){await writer?.abort().catch(()=>{});throw e;}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function importCustomDecisionModel(review:CustomReview,signal:AbortSignal,progress:(text:string)=>void=()=>{},io:IO=ioDefault){
 const model=validateLocalModel(review.model) as CustomDecisionModel;if(model.role!=='decision'||review.files.length!==model.files.length)throw Error('Invalid Decision model review');
 for(const [index,pin] of model.files.entries()){check(signal);const file=review.files[index];if(file.size!==pin.bytes)throw Error('Decision model files changed');try{await readCustomDecisionFile(model,pin.path,signal,progress,io);check(signal);continue;}catch(e){check(signal);const error=e as Error;if(error.name!=='NotFoundError'&&!/missing/i.test(error.message))throw error;}
  await writeCustomDecisionFile(file,pin,signal,progress,io);
 }check(signal);return model;
}
export async function readCustomDecisionFile(model:CustomDecisionModel,path:string,signal:AbortSignal,progress:(text:string)=>void=()=>{},io:IO=ioDefault){
 const declaration=validateLocalModel(model) as CustomDecisionModel,pin=declaration.files.find(file=>file.path===path);if(!pin)throw Error('Unknown custom Decision asset');check(signal);const directory=await io.directory();check(signal);const file=await(await directory.getFileHandle(pin.sha256)).getFile();return hashDecisionFile(file,pin,signal,progress);
}
export const decisionFile=(path:string)=>manifest.files.find(f=>f.path===path);
async function hashDecisionFile(file:File,pin:{bytes:number;sha256:string},signal:AbortSignal,progress:(s:string)=>void){
 check(signal);if(file.size!==pin.bytes)throw Error('Decision asset verification failed');const reader=file.stream().getReader(),hash=new SHA256();let count=0,last=0;
 try{for(;;){check(signal);const {value,done}=await reader.read();check(signal);if(done)break;hash.update(value);count+=value.length;if(count-last>8000000){progress('Verifying · '+Math.round(count/pin.bytes*100)+'%');last=count;await new Promise<void>(resolve=>setTimeout(resolve,0));check(signal);}}if(count!==pin.bytes||hash.hex()!==pin.sha256)throw Error('Decision asset verification failed');check(signal);return file;}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function readDecisionFile(path:string,signal:AbortSignal,progress:(s:string)=>void=()=>{},io:IO=ioDefault){
 const pin=decisionFile(path);if(!pin)throw Error('Unknown decision asset');check(signal);const directory=await io.directory();check(signal);const file=await(await directory.getFileHandle(pin.sha256)).getFile();return hashDecisionFile(file,pin,signal,progress);
}
export async function decisionStatus(signal:AbortSignal,progress:(s:string)=>void=()=>{},model:string|CustomDecisionModel=manifest.id){
 try{const descriptor=decisionModelDescriptor(model);for(const pin of descriptor.files){check(signal);if(descriptor.custom)await readCustomDecisionFile(model as CustomDecisionModel,pin.path,signal,progress);else await readDecisionFile(pin.path,signal,progress);}check(signal);return {prepared:true,bytes:descriptor.files.reduce((n,f)=>n+f.bytes,0)};}
 catch{check(signal);return {prepared:false,bytes:0};}
}
export async function prepareDecisionFile(path:string,allowNetwork:boolean,signal:AbortSignal,progress:(s:string)=>void,io:IO=ioDefault){
 const pin=decisionFile(path);if(!pin)throw Error('Unknown decision asset');check(signal);
 try{await readDecisionFile(path,signal,progress,io);check(signal);return;}catch{check(signal);}
 if(!allowNetwork)throw Error('Downloads are off');
 const response=await io.fetch(pin.url,{signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});check(signal);if(!response.ok||!response.body)throw Error('Decision download failed');
 const reader=response.body.getReader(),hash=new SHA256();let writer:FileSystemWritableFileStream|undefined,count=0,last=0;
 // createWritable commits atomically on close. Abort never deletes/replaces an
 // existing cached file; cancellation after verification cannot start a writer.
 try{const directory=await io.directory();check(signal);const handle=await directory.getFileHandle(pin.sha256,{create:true});check(signal);writer=await handle.createWritable();for(;;){check(signal);const {value,done}=await reader.read();check(signal);if(done)break;count+=value.length;if(count>pin.bytes)throw Error('Decision asset verification failed');hash.update(value);await writer.write(value);if(Date.now()-last>250){progress('Downloading · '+(count/1e6).toFixed(1)+' / '+(pin.bytes/1e6).toFixed(1)+' MB');last=Date.now();}}check(signal);if(count!==pin.bytes||hash.hex()!==pin.sha256)throw Error('Decision asset verification failed');await writer.close();check(signal);}
 catch(e){await writer?.abort().catch(()=>{});throw e;}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function prepareDecision(allowNetwork:boolean,signal:AbortSignal,progress:(s:string)=>void,fetcher=globalThis.fetch.bind(globalThis),model:string|CustomDecisionModel=manifest.id){
 const descriptor=decisionModelDescriptor(model);if(descriptor.custom){for(const [i,pin] of descriptor.files.entries()){check(signal);progress('Verifying local model · '+(i+1)+' / '+descriptor.files.length);await readCustomDecisionFile(model as CustomDecisionModel,pin.path,signal,progress);}check(signal);return {prepared:true,bytes:descriptor.files.reduce((n,f)=>n+f.bytes,0)};}
 for(const [i,pin] of manifest.files.entries()){check(signal);progress('Preparing '+(i+1)+' / '+manifest.files.length);await prepareDecisionFile(pin.path,allowNetwork,signal,progress,{directory:localDirectory,fetch:fetcher});}check(signal);return {prepared:true,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0)};
}
