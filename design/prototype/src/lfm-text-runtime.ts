import {createTextInference,type TextRuntime} from './text-inference.ts';
import {createStructuredGrammar,createStructuredSchema,type StructuredFormat} from './structured-grammar.ts';
import {PlannerOutputError} from './planner-error.ts';

type Adapter={readonly loaded?:string|null;readonly supportsExactCount:boolean;readonly maxReplyTokens:number;load:(file:File,id:string,options:{backend:'cpu'})=>Promise<unknown>;unload:()=>Promise<void>;abort:()=>void;count:(messages:any[],options:{json:boolean})=>Promise<number>;generate:(messages:any[],options:{json:boolean;maxTokens:number;jsonSchema?:Record<string,unknown>})=>Promise<{text:string}>};
type Manifest={contextTokens:number;runtime:{revision:string};models:{id:string;revision:string;file:{name:string;bytes:number}}[]};
// Prepared-file provider and adapter factory are app code, never model-supplied code.
export function createLfmTextRuntime({adapter,manifest,readFile,readAssets}:{adapter:Adapter;manifest:Manifest;readFile:(id:string)=>Promise<Blob>;readAssets:()=>TextRuntime['assets']}):TextRuntime&{unload:()=>Promise<void>}{
 const fixed=structuredClone(manifest);
 if(fixed.contextTokens!==2048||!fixed.runtime.revision||!fixed.models.length||new Set(fixed.models.map(m=>m.id)).size!==fixed.models.length||fixed.models.some(m=>!m.id||!m.revision||!m.file.name||!Number.isSafeInteger(m.file.bytes)||m.file.bytes<1)||!Number.isSafeInteger(adapter.maxReplyTokens)||adapter.maxReplyTokens<1||adapter.maxReplyTokens>768)throw Error('Invalid LFM text runtime manifest');
 let epoch=0,busy=false;
 async function operation<T>(work:(check:()=>void)=>Promise<T>):Promise<T>{if(busy)throw Error('Model busy');busy=true;const own=epoch,check=()=>{if(own!==epoch)throw Error('Stopped');};try{const result=await work(check);check();return result;}finally{busy=false;}}
 const raw:TextRuntime={get manifest(){return structuredClone(fixed);},get loaded(){return adapter.loaded??'';},get assets(){return readAssets();},
  async load(id){const model=fixed.models.find(m=>m.id===id);if(!model)throw Error('Unknown LFM model');return operation(async check=>{const file=await readFile(id);check();if(file.size!==model.file.bytes)throw Error('Model integrity mismatch');await adapter.unload();check();await adapter.load(new File([file],model.file.name),id,{backend:'cpu'});check();if(!adapter.supportsExactCount){await adapter.unload();throw Error('Exact pre-generation token count unavailable');}});},
  stop(){epoch++;adapter.abort();},
  count(messages){return operation(async check=>{const tokens=await adapter.count(messages,{json:true});check();return {prompt_tokens:tokens};});},
  generate(messages,maxTokens=256,format?:StructuredFormat){return operation(async check=>{if(!Number.isSafeInteger(maxTokens)||maxTokens<1||maxTokens>adapter.maxReplyTokens)throw Error('Output budget exceeded');const grammar=format?createStructuredGrammar(format):null,jsonSchema=format?createStructuredSchema(format):undefined;const output=await adapter.generate(messages,{json:true,maxTokens,...(jsonSchema?{jsonSchema}:{})});check();if(grammar){const state=grammar.advance(grammar.initial,new TextEncoder().encode(output.text));if(!state||!grammar.complete(state))throw new PlannerOutputError('Invalid model JSON - structured output rejected',output.text.slice(0,8192),'structured:incomplete');}return output;});},
 };
 const inference=createTextInference(()=>raw);
 return {...inference,get manifest(){return raw.manifest;},get loaded(){return raw.loaded;},get assets(){return raw.assets;},async unload(){if(busy)throw Error('Model busy');inference.stop();return operation(async check=>{await adapter.unload();check();});}};
}
