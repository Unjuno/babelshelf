import {createTextInference,type TextRuntime,type GenerationFormat} from './text-inference.ts';
import {createStructuredGrammar,createStructuredSchema} from './structured-grammar.ts';
import {PlannerOutputError} from './planner-error.ts';

type Adapter={readonly loaded?:string|null;readonly info?:{requestedThreads?:number;activeThreads?:number}|null;readonly supportsExactCount:boolean;readonly maxReplyTokens:number;load:(file:File,id:string,options:{backend:'cpu'})=>Promise<unknown>;unload:()=>Promise<void>;abort:()=>void;count:(messages:any[],options:{json:boolean})=>Promise<number>;generate:(messages:any[],options:{json:boolean;maxTokens:number;jsonSchema?:Record<string,unknown>})=>Promise<{text:string;outputTokens?:number;firstContentMs?:number|null;totalMs?:number;tokensPerSecond?:number|null;timings?:{prompt_ms?:number;predicted_ms?:number;predicted_per_second?:number;prompt_n?:number;cache_n?:number}|null}>};
type Manifest={contextTokens:number;runtime:{revision:string};models:{id:string;revision:string;contextTokens:number;file:{name:string;bytes:number}}[]};
// Prepared-file provider and adapter factory are app code, never model-supplied code.
export function createLfmTextRuntime({adapter,manifest,readFile,readAssets}:{adapter:Adapter;manifest:Manifest;readFile:(id:string)=>Promise<Blob>;readAssets:()=>TextRuntime['assets']}):TextRuntime&{unload:()=>Promise<void>}{
 const fixed=structuredClone(manifest);
 if(fixed.contextTokens!==2048||!fixed.runtime.revision||!fixed.models.length||new Set(fixed.models.map(m=>m.id)).size!==fixed.models.length||fixed.models.some(m=>!m.id||!m.revision||![2048,4096,8192].includes(m.contextTokens)||!m.file.name||!Number.isSafeInteger(m.file.bytes)||m.file.bytes<1)||!Number.isSafeInteger(adapter.maxReplyTokens)||adapter.maxReplyTokens<1||adapter.maxReplyTokens>768)throw Error('Invalid LFM text runtime manifest');
 let epoch=0,busy=false;
 async function operation<T>(work:(check:()=>void)=>Promise<T>):Promise<T>{if(busy)throw Error('Model busy');busy=true;const own=epoch,check=()=>{if(own!==epoch)throw Error('Stopped');};try{const result=await work(check);check();return result;}finally{busy=false;}}
 const raw:TextRuntime={get manifest(){const selected=fixed.models.find(m=>m.id===(adapter.loaded??''));return {...structuredClone(fixed),contextTokens:selected?.contextTokens??fixed.contextTokens};},get loaded(){return adapter.loaded??'';},get assets(){return readAssets();},
  async load(id){const model=fixed.models.find(m=>m.id===id);if(!model)throw Error('Unknown LFM model');return operation(async check=>{const file=await readFile(id);check();if(file.size!==model.file.bytes)throw Error('Model integrity mismatch');await adapter.unload();check();const immutableFile=typeof File!=='undefined'&&file instanceof File?file:new File([file],model.file.name);await adapter.load(immutableFile,id,{backend:'cpu'});check();if(!adapter.supportsExactCount){await adapter.unload();throw Error('Exact pre-generation token count unavailable');}});},
  stop(){epoch++;adapter.abort();},
  count(messages,format){return operation(async check=>{const tokens=await adapter.count(messages,{json:format!=='prose'});check();return {prompt_tokens:tokens};});},
  generate(messages,maxTokens=256,format?:GenerationFormat){return operation(async check=>{if(!Number.isSafeInteger(maxTokens)||maxTokens<1||maxTokens>adapter.maxReplyTokens)throw Error('Output budget exceeded');const grammar=format&&format!=='prose'?createStructuredGrammar(format):null,jsonSchema=format&&format!=='prose'?createStructuredSchema(format):undefined;const output=await adapter.generate(messages,{json:format!=='prose',maxTokens,...(jsonSchema?{jsonSchema}:{})});check();if(grammar){const state=grammar.advance(grammar.initial,new TextEncoder().encode(output.text));if(!state||!grammar.complete(state))throw new PlannerOutputError('Invalid model JSON - structured output rejected',output.text.slice(0,8192),'structured:incomplete');}
   // The shared inference boundary filters these optional numeric metrics. Do
   // not forward the adapter's raw usage/timings objects into app receipts.
   // These are native server timing fields, not estimates from first content.
   // runtimeThreads is wllama's reported pool size, not measured CPU utilization.
   return {text:output.text,outputTokens:output.outputTokens,metrics:{visibleTextTtftMs:output.firstContentMs??undefined,generationMs:output.totalMs,generationTokensPerSecond:output.tokensPerSecond??undefined,runtimePrefillMs:output.timings?.prompt_ms,runtimeDecodeMs:output.timings?.predicted_ms,runtimeDecodeTokensPerSecond:output.timings?.predicted_per_second,runtimePromptTokens:output.timings?.prompt_n,runtimeCachedTokens:output.timings?.cache_n,requestedThreads:adapter.info?.requestedThreads,runtimeThreads:adapter.info?.activeThreads}};
  });},
 };
 const inference=createTextInference(()=>raw);
 return {...inference,get manifest(){return raw.manifest;},get loaded(){return raw.loaded;},get assets(){return raw.assets;},async unload(){if(busy)throw Error('Model busy');inference.stop();return operation(async check=>{await adapter.unload();check();});}};
}
