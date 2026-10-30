import {createTextInference,type TextRuntime,type EngineGenerationFormat,type NativeToolPlanFormat} from './text-inference.ts';
import {createStructuredGrammar,createStructuredSchema} from './structured-grammar.ts';
import {PlannerOutputError} from './planner-error.ts';
import {nativeFinalActionBinding} from './native-output-format.ts';
// @ts-expect-error Shared native-tool transport bound is JavaScript.
import {MAX_NATIVE_TOOL_CALLS,MAX_NATIVE_TOOL_DEFINITIONS} from '../../../dist/lfm-adapter.js';

type Adapter={readonly loaded?:string|null;readonly nativeToolCalls?:boolean;readonly info?:{requestedThreads?:number;activeThreads?:number;actualGpuLayers?:number|null;totalModelLayers?:number|null;gpuLayerEvidence?:'cpu-route-requested'|'runtime-offload-log'|'unobserved'}|null;readonly supportsExactCount:boolean;readonly maxReplyTokens:number;preflightBackend?:(backend:'cpu'|'webgpu')=>Promise<void>|void;load:(file:File,id:string,options:{backend:'cpu'|'webgpu'})=>Promise<unknown>;unload:()=>Promise<void>;abort:()=>void;count:(messages:any[],options:{json:boolean;tools?:NativeToolPlanFormat['tools']})=>Promise<number>;generate:(messages:any[],options:{json:boolean;maxTokens:number;onAnswerPreview?:(text:string)=>void;jsonSchema?:Record<string,unknown>;tools?:NativeToolPlanFormat['tools']})=>Promise<{text:string;assistantContent?:string;finishReason?:string;toolCalls?:{id?:string;name:string;arguments:Record<string,unknown>}[];outputTokens?:number;firstContentMs?:number|null;totalMs?:number;tokensPerSecond?:number|null;timings?:{prompt_ms?:number;predicted_ms?:number;predicted_per_second?:number;prompt_n?:number;cache_n?:number}|null}>};
type Manifest={contextTokens:number;runtime:{revision:string};models:{id:string;revision:string;engine?:string;contextTokens:number;file:{name:string;bytes:number}}[]};
function isNativePlanFormat(format:EngineGenerationFormat|undefined):format is NativeToolPlanFormat{return !!format&&typeof format==='object'&&format.type==='native-tool-plan';}
function validateNativeTools(tools:NativeToolPlanFormat['tools']){if(!Array.isArray(tools)||!tools.length||tools.length>MAX_NATIVE_TOOL_DEFINITIONS||new Set(tools.map(tool=>tool?.function?.name)).size!==tools.length||tools.some(tool=>tool?.type!=='function'||Object.hasOwn(tool,'defer_loading')||!tool.function||typeof tool.function.name!=='string'||!/^[a-z][a-z0-9_.-]{0,63}$/.test(tool.function.name)||typeof tool.function.description!=='string'||!tool.function.description||tool.function.description.length>1000||!tool.function.parameters||typeof tool.function.parameters!=='object'||Array.isArray(tool.function.parameters)))throw Error('Invalid native tool plan');return tools;}
function normalizeNativeCompletion(output:Awaited<ReturnType<Adapter['generate']>>,tools:NativeToolPlanFormat['tools']):{text:string;assistantContent?:string}{
 const calls=output.toolCalls??[];
 if(!Array.isArray(calls)||calls.length>MAX_NATIVE_TOOL_CALLS)throw new PlannerOutputError('Invalid native tool calls','', 'native-tool-call');
 if(!calls.length){
  if(typeof output.text!=='string'||!output.text.trim())throw new PlannerOutputError('Empty native completion','', 'native-tool-call');
  // Native chat completion may end with ordinary prose. It can only become a
  // read-only answer; never parse its contents as actions or fabricate sources.
  // The planner still requires visible successful evidence, validates original
  // citations and rejects incomplete output before this answer can be shown.
  return {text:JSON.stringify({action:'answer',query:'',reply:{status:'answered',answer:output.text,sources:[]}})};
 }
 const functions=new Map(tools.map(tool=>[tool.function.name,tool]));
 const normalized=calls.map(call=>{
  if(!call||!functions.has(call.name)||!call.arguments||Object.getPrototypeOf(call.arguments)!==Object.prototype)throw new PlannerOutputError('Unknown or malformed native tool call','', 'native-tool-call');
  return {id:call.id,name:call.name,arguments:call.arguments};
 });
 const actions=normalized.filter(call=>call.name==='plan_action'||call.name.startsWith('finish_'));
 if(actions.length){
  if(normalized.length!==1)throw new PlannerOutputError('Final plan cannot be mixed with tool calls',JSON.stringify({calls:normalized.map(call=>call.name)}),'native-final-mixed');
  const selected=actions[0],binding=nativeFinalActionBinding(selected.name);
  if(binding&&Object.keys(binding).some(key=>Object.hasOwn(selected.arguments,key)))throw new PlannerOutputError('Final action cannot override its bound selectors','', 'native-tool-call');
  // Only the validated function arguments form the final action/answer. A
  // conversational preface neither overrides them nor becomes saved content.
  return {text:JSON.stringify({...binding,...selected.arguments})};
 }
 const text=normalized.length===1?JSON.stringify({action:'tool',query:normalized[0].name,body:JSON.stringify(normalized[0].arguments)}):JSON.stringify({action:'tool_batch',calls:normalized.map(call=>({tool:call.name,arguments:call.arguments}))});
 const assistantContent=output.assistantContent??output.text;
 if(typeof assistantContent!=='string'||assistantContent.length>32768)throw new PlannerOutputError('Invalid assistant tool context','', 'native-tool-call');
 return {text,...(assistantContent?{assistantContent}:{})};
}
// Prepared-file provider and adapter factory are app code, never model-supplied code.
export function createLfmTextRuntime({adapter,manifest,readFile,readAssets,backend='cpu'}:{adapter:Adapter;manifest:Manifest;readFile:(id:string)=>Promise<Blob>;readAssets:()=>TextRuntime['assets'];backend?:'cpu'|'webgpu'|'auto'}):TextRuntime&{unload:()=>Promise<void>}{
 const fixed=structuredClone(manifest);
 const standardContexts=[2048,4096,8192,16384,32768],lfm3Contexts=[...standardContexts,65536,131072,262144],supports=(engine:string|undefined,size:number)=>(engine==='wllama-lfm3'?lfm3Contexts:standardContexts).includes(size);
 const topContextSupported=supports(undefined,fixed.contextTokens)||fixed.models.some(m=>m.engine==='wllama-lfm3'&&m.contextTokens===fixed.contextTokens);
 if(!topContextSupported||!fixed.runtime.revision||!fixed.models.length||new Set(fixed.models.map(m=>m.id)).size!==fixed.models.length||fixed.models.some(m=>!m.id||!m.revision||!supports(m.engine,m.contextTokens)||!m.file.name||!Number.isSafeInteger(m.file.bytes)||m.file.bytes<1)||!Number.isSafeInteger(adapter.maxReplyTokens)||adapter.maxReplyTokens<1||adapter.maxReplyTokens>3072)throw Error('Invalid LFM text runtime manifest');
 let epoch=0,busy=false,loadedBackend:'cpu'|'webgpu'|undefined;
 async function operation<T>(work:(check:()=>void)=>Promise<T>):Promise<T>{if(busy)throw Error('Model busy');busy=true;const own=epoch,check=()=>{if(own!==epoch)throw Error('Stopped');};try{const result=await work(check);check();return result;}finally{busy=false;}}
 const raw:TextRuntime={get plannerProtocol(){return adapter.nativeToolCalls?'native-tool-calls':'json';},get manifest(){const selected=fixed.models.find(m=>m.id===(adapter.loaded??''));return {...structuredClone(fixed),contextTokens:selected?.contextTokens??fixed.contextTokens,maxOutputTokens:adapter.maxReplyTokens};},get loaded(){return adapter.loaded??'';},get assets(){return readAssets();},
  async load(id){const model=fixed.models.find(m=>m.id===id);if(!model)throw Error('Unknown LFM model');return operation(async check=>{
   // A resident model is already integrity-checked and pinned to this immutable
   // manifest. Avoid rereading and rehashing a multi-gigabyte OPFS file, then
   // tearing down the live GPU/CPU session on repeated turns.
   if(adapter.loaded===id){check();if(!adapter.supportsExactCount)throw Error('Exact pre-generation token count unavailable');return loadedBackend?{executionBackend:loadedBackend==='cpu'?'cpu-wasm' as const:'webgpu' as const}:undefined;}
   const totalStarted=performance.now();let effectiveBackend:'cpu'|'webgpu';
   if(backend==='auto'){
    try{await adapter.preflightBackend?.('webgpu');effectiveBackend='webgpu';}
    catch(error){if((error as {code?:unknown}|null)?.code!=='webgpu_unavailable')throw error;effectiveBackend='cpu';await adapter.preflightBackend?.('cpu');}
   }else{effectiveBackend=backend;await adapter.preflightBackend?.(effectiveBackend);}
   check();const file=await readFile(id);check();if(file.size!==model.file.bytes)throw Error('Model integrity mismatch');await adapter.unload();loadedBackend=undefined;check();const immutableFile=typeof File!=='undefined'&&file instanceof File?file:new File([file],model.file.name);let rawMetrics:unknown;
   try{rawMetrics=await adapter.load(immutableFile,id,{backend:effectiveBackend});}
   catch(error){if(backend!=='auto'||effectiveBackend!=='webgpu'||(error as {code?:unknown}|null)?.code!=='webgpu_unavailable')throw error;effectiveBackend='cpu';await adapter.preflightBackend?.('cpu');check();rawMetrics=await adapter.load(immutableFile,id,{backend:'cpu'});}
   check();if(!adapter.supportsExactCount){await adapter.unload();loadedBackend=undefined;throw Error('Exact pre-generation token count unavailable');}loadedBackend=effectiveBackend;
   const source=rawMetrics&&typeof rawMetrics==='object'?rawMetrics as Record<string,unknown>:{};
   return { ...(typeof source.verificationMs==='number'&&Number.isFinite(source.verificationMs)&&source.verificationMs>=0?{verificationMs:source.verificationMs}:{}), ...(typeof source.runtimeLoadMs==='number'&&Number.isFinite(source.runtimeLoadMs)&&source.runtimeLoadMs>=0?{runtimeLoadMs:source.runtimeLoadMs}:{}), totalLoadMs:Math.max(0,performance.now()-totalStarted),executionBackend:effectiveBackend==='cpu'?'cpu-wasm' as const:'webgpu' as const };
  });},
  stop(){epoch++;adapter.abort();},
  count(messages,format){return operation(async check=>{const native=isNativePlanFormat(format),tools=native?validateNativeTools(format.tools):undefined;if(native&&!adapter.nativeToolCalls)throw Error('Native tool calls unsupported by this model runtime');const tokens=await adapter.count(messages,{json:!native&&format!=='prose',...(tools?{tools}:{})});check();return {prompt_tokens:tokens};});},
  generate(messages,maxTokens=256,format?:EngineGenerationFormat,onPreview?:(text:string)=>void){return operation(async check=>{if(!Number.isSafeInteger(maxTokens)||maxTokens<1||maxTokens>adapter.maxReplyTokens)throw Error('Output budget exceeded');const native=isNativePlanFormat(format),tools=native?validateNativeTools(format.tools):undefined;if(native&&!adapter.nativeToolCalls)throw Error('Native tool calls unsupported by this model runtime');const grammar=!native&&format&&format!=='prose'?createStructuredGrammar(format):null,jsonSchema=!native&&format&&format!=='prose'?createStructuredSchema(format):undefined;const output=await adapter.generate(messages,{json:!native&&format!=='prose',maxTokens,...(onPreview?{onAnswerPreview:(text:string)=>{check();onPreview(text);}}:{}),...(jsonSchema?{jsonSchema}:{}),...(tools?{tools}:{})});check();const {text,assistantContent}=native?normalizeNativeCompletion(output,tools!):{text:output.text,assistantContent:undefined};if(grammar){const state=grammar.advance(grammar.initial,new TextEncoder().encode(text));if(!state||!grammar.complete(state))throw new PlannerOutputError('Invalid model JSON - structured output rejected',text.slice(0,8192),'structured:incomplete');}
   // The shared inference boundary filters these optional numeric metrics. Do
   // not forward the adapter's raw usage/timings objects into app receipts.
   // These are native server timing fields, not estimates from first content.
   // runtimeThreads is wllama's reported pool size, not measured CPU utilization.
   const gpuObserved=adapter.info?.gpuLayerEvidence==='runtime-offload-log';
   return {text,...(output.finishReason?{finishReason:output.finishReason}:{}),...(assistantContent?{assistantContent}:{}),outputTokens:output.outputTokens,metrics:{visibleTextTtftMs:output.firstContentMs??undefined,generationMs:output.totalMs,generationTokensPerSecond:output.tokensPerSecond??undefined,runtimePrefillMs:output.timings?.prompt_ms,runtimeDecodeMs:output.timings?.predicted_ms,runtimeDecodeTokensPerSecond:output.timings?.predicted_per_second,runtimePromptTokens:output.timings?.prompt_n,runtimeCachedTokens:output.timings?.cache_n,requestedThreads:adapter.info?.requestedThreads,runtimeThreads:adapter.info?.activeThreads,runtimeObservedGpuLayers:gpuObserved?adapter.info?.actualGpuLayers??undefined:undefined,runtimeObservedGpuTotalLayers:gpuObserved?adapter.info?.totalModelLayers??undefined:undefined}};
  });},
 };
 const inference=createTextInference(()=>raw);
 return {...inference,get manifest(){return raw.manifest;},get plannerProtocol(){return adapter.nativeToolCalls?'native-tool-calls':'json';},get loaded(){return raw.loaded;},get assets(){return raw.assets;},async unload(){if(busy)throw Error('Model busy');inference.stop();return operation(async check=>{await adapter.unload();loadedBackend=undefined;check();});}};
}
