import {nativeAnswerPreview} from './native-answer-preview.js';
import {hashLocalModel,localTextContextOptions} from './local-models.js';
import {inferenceThreadCount} from './inference-threads.js';
// Transport bound, not the agent's execution budget; activity receipts impose
// the actual lower per-turn budget before any proposed batch is executed.
export const MAX_NATIVE_TOOL_CALLS=128;
// Includes the selected (up to 64) tool catalog plus scoped final-action functions.
// This transport bound does not expand the configured or per-turn tool budget.
export const MAX_NATIVE_TOOL_DEFINITIONS=96;
function checkStreamRepetition(value,added,messages,controller){
 // Stop a degenerate decode before it burns the remaining token budget.
 // Check only the appended span plus its boundary; allow exact supplied literals.
 const span=value.slice(-added.length-512),match=/([^\s])\1{255}/u.exec(span);
 if(match&&!messages.some(message=>message.content.includes(match[0]))){const error=Error('Model generated repeated text · retry');error.code='repeated_output';controller.abort();throw error;}
}
function observedRuntimeLogger(logger,onGpuLayers){
 const target=logger??console;
 return new Proxy(target,{get(object,key){const value=Reflect.get(object,key,object);if(typeof value!=='function')return value;return (...args)=>{if(['log','debug','info','warn'].includes(key))for(const arg of args){if(typeof arg!=='string')continue;const match=/\boffloaded\s+(\d+)\s*\/\s*(\d+)\s+layers\s+to\s+GPU\b/i.exec(arg);if(match){const loaded=Number(match[1]),total=Number(match[2]);if(Number.isSafeInteger(loaded)&&Number.isSafeInteger(total)&&loaded<=total)onGpuLayers(loaded,total);}}return value.apply(object,args);};}});
}
// Pinned Wllama exact-count accepts string content. Its llama.cpp parser does
// not carry deferred-tool fields into the template; reveal schemas in the app.
function validMessageContent(message){return typeof message.content==='string'&&message.content.length<=262144;}
function validNativeTools(tools,architecture){return architecture==='lfm3'&&Array.isArray(tools)&&tools.length>0&&tools.length<=MAX_NATIVE_TOOL_DEFINITIONS&&new Set(tools.map(tool=>tool?.function?.name)).size===tools.length&&tools.every(tool=>tool?.type==='function'&&!Object.hasOwn(tool,'defer_loading')&&typeof tool.function?.name==='string'&&tool.function.parameters&&typeof tool.function.parameters==='object'&&!Array.isArray(tool.function.parameters));}
function validChatMessages(messages,architecture){return Array.isArray(messages)&&messages.length>0&&messages.length<=512&&messages.every(message=>{if(!message||typeof message!=='object'||!['system','user','assistant','tool'].includes(message.role)||!validMessageContent(message,architecture))return false;if(message.role==='tool'&&(typeof message.tool_call_id!=='string'||!message.tool_call_id||message.tool_call_id.length>256))return false;if(message.tool_calls!==undefined){if(message.role!=='assistant'||!Array.isArray(message.tool_calls)||!message.tool_calls.length||message.tool_calls.length>MAX_NATIVE_TOOL_CALLS)return false;for(const call of message.tool_calls){if(!call||call.type!=='function'||typeof call.id!=='string'||!call.id||call.id.length>256||!call.function||typeof call.function.name!=='string'||call.function.name.length>128||!call.function.arguments||typeof call.function.arguments!=='object'||Array.isArray(call.function.arguments))return false;}}return true;});}
// App-owned prepared-file adapter. Never uses URL/HF download methods.
export class PreparedGgufAdapter {
 constructor({Wllama,paths,compat,models,architecture,clock=()=>performance.now(),logger=console,maxReplyTokens=256,reusePrompt=false,onProgress=()=>{}}){if(!['lfm2','lfm3','qwen3'].includes(architecture))throw Error('Unsupported GGUF adapter architecture');if(typeof reusePrompt!=='boolean'||reusePrompt&&!['lfm2','lfm3'].includes(architecture))throw Error('Unsupported prompt reuse policy');if(!paths?.default||!compat?.wasm||!compat?.worker)throw Error('Local runtime assets required');const outputCeiling=architecture==='lfm3'?3072:768;if(!Number.isSafeInteger(maxReplyTokens)||maxReplyTokens<1||maxReplyTokens>outputCeiling)throw Error('Invalid output budget');Object.defineProperty(this,'architecture',{value:architecture});Object.defineProperty(this,'maxReplyTokens',{value:maxReplyTokens});Object.defineProperty(this,'reusePrompt',{value:reusePrompt});this.promptCacheReady=false;this.onProgress=onProgress;this.Wllama=Wllama;this.paths=paths;this.compat=compat;this.models=models;this.clock=clock;this.logger=logger;this.runtime=null;this.busy=false;this.epoch=0;this.verifiedFiles=new WeakMap();}
 // Native LFM3 tool turns use the checkpoint's reasoning mode. Keep current-turn
 // reasoning in transient assistant history only; never stream it as an answer.
 templateOptions(nativeTools=false){return this.architecture==='lfm3'?{chat_template_kwargs:{enable_thinking:nativeTools,preserve_thinking:false}}:this.architecture==='qwen3'?{chat_template_kwargs:{enable_thinking:false}}:{};}
 samplingOptions(){return this.architecture==='lfm3'?{temperature:0.1,top_k:50,repeat_penalty:1.1}:{temperature:0};}
 async preflightBackend(backend){if(!['cpu','webgpu'].includes(backend))throw Error('Select explicit backend');if(this.architecture==='qwen3'&&backend!=='cpu')throw Error('Qwen3 adapter is CPU only');if(backend==='webgpu'){if(!globalThis.navigator?.gpu){const error=Error('WebGPU unavailable');error.code='webgpu_unavailable';throw error;}if(!await navigator.gpu.requestAdapter({powerPreference:'high-performance'})){const error=Error('WebGPU unavailable');error.code='webgpu_unavailable';throw error;}}}
 async load(file,id,{backend,signal}={}){
  if(this.busy||this.runtime)throw Error('Unload model first');const model=this.models.find(m=>m.id===id);if(!model)throw Error('Unknown GGUF model');this.busy=true;const loadStart=this.clock(),epoch=this.epoch,check=()=>{signal?.throwIfAborted();if(epoch!==this.epoch)throw Error('Stopped');};let runtime;
  try{check();await this.preflightBackend(backend);check();this.promptCacheReady=false;const maxContext=model.localModel?.inspection?.contextLength??model.contextTokens;if(!localTextContextOptions(maxContext,model.engine).includes(model.contextTokens))throw Error('Unsupported model context window');this.onProgress('Verifying model');let lastPercent=-1;const progress=(bytes,total)=>{const percent=Math.floor(bytes/total*100);if(percent!==lastPercent){lastPercent=percent;this.onProgress(`Verifying model · ${percent}%`);}};if(file.size!==model.file.bytes)throw Error('Model integrity mismatch');
   // File/Blob contents are immutable snapshots. Reuse a successful digest only
   // for the exact same File object and expected pin; a new snapshot is hashed.
   const cached=typeof File!=='undefined'&&file instanceof File?this.verifiedFiles.get(file):undefined;
   if(cached!==model.file.sha256){if(await hashLocalModel(file,{signal,progress})!==model.file.sha256)throw Error('Model integrity mismatch');check();if(typeof File!=='undefined'&&file instanceof File)this.verifiedFiles.set(file,model.file.sha256);}check();
   check();
   let gpuLayerObservation=null;const logger=observedRuntimeLogger(this.logger,(loaded,total)=>{gpuLayerObservation={loaded,total};});
   runtime=new this.Wllama(this.paths,{logger});runtime.setCompat(this.compat);this.runtime=runtime;const start=this.clock();
   const requestedThreads=inferenceThreadCount();this.onProgress('Loading model');await runtime.loadModel([file],{n_ctx:model.contextTokens,n_threads:requestedThreads,n_gpu_layers:backend==='cpu'?0:99999,n_parallel:1,n_batch:128,n_ubatch:128,cache_idle_slots:false,n_cache_reuse:0,...(this.architecture==='lfm3'?{n_ctx_checkpoints:8,checkpoint_min_step:512,swa_full:this.reusePrompt}:{}),warmup:false,seed:0,...(this.architecture==='qwen3'?{reasoning:false,cache_type_k:'q8_0',cache_type_v:'q8_0'}:{})});check();
   const template=runtime.getChatTemplate();if(typeof template!=='string'||!template.trim())throw Error('GGUF chat template missing');const context=runtime.getLoadedContextInfo();if(context.metadata?.['general.architecture']!==this.architecture)throw Error('Unexpected GGUF architecture');if(context.n_ctx!==model.contextTokens)throw Error('Runtime context does not match selected model context');
   this.loaded=id;this.info={model:id,backend,actualGpuLayers:gpuLayerObservation?.loaded??null,totalModelLayers:gpuLayerObservation?.total??null,gpuLayerEvidence:gpuLayerObservation?'runtime-offload-log':backend==='cpu'?'cpu-route-requested':'unobserved',requestedThreads,activeThreads:runtime.useMultiThread===true?runtime.nbThreads:1,loadMs:this.clock()-loadStart,runtimeLoadMs:this.clock()-start,verificationMs:start-loadStart,context,template,workerResources:{compat:runtime.getWorkerResources().compat,wasmPath:runtime.getWorkerResources().wasmPath},runtimeVersion:this.Wllama.getLibllamaVersion()};return this.info;
  }catch(error){await runtime?.exit().catch(()=>{});this.runtime=null;this.loaded=null;if(signal?.aborted||epoch!==this.epoch)throw Error('Stopped');throw error;}finally{this.busy=false;}
 }
 get supportsExactCount(){return typeof this.runtime?.countChatTokens==='function';}
  async count(messages,{signal,json=true,tools}={}){
  if(this.busy||!this.runtime||!this.loaded)throw Error('Model not ready');
  if(!validChatMessages(messages,this.architecture))throw Error('Invalid messages');if(tools!==undefined&&!validNativeTools(tools,this.architecture))throw Error('Invalid native tools');if(tools&&json)throw Error('Native tools cannot use constrained JSON mode');
  if(typeof this.runtime.countChatTokens!=='function')throw Error('Exact pre-generation token count unavailable');
  const epoch=this.epoch,check=()=>{if(signal?.aborted||epoch!==this.epoch)throw Error('Stopped');};check();this.busy=true;
  try{this.onProgress('Counting tokens');const count=await this.runtime.countChatTokens({messages,...this.templateOptions(!!tools),...(tools?{tools,tool_choice:'required'}:{}),...(json?{response_format:{type:'json_object'}}:{})});check();if(!Number.isSafeInteger(count)||count<0)throw Error('Invalid prompt token count');return count;}finally{this.busy=false;}
 }
 async generate(messages,{signal,maxTokens=256,onContent=()=>{},onAnswerPreview=()=>{},json=true,jsonSchema,tools}={}){
  if(this.busy||!this.runtime||!this.loaded)throw Error('Model not ready');if(!Number.isInteger(maxTokens)||maxTokens<1||maxTokens>this.maxReplyTokens)throw Error('Output budget exceeded');if(!validChatMessages(messages,this.architecture))throw Error('Invalid messages');if(tools!==undefined&&!validNativeTools(tools,this.architecture))throw Error('Invalid native tools');if(tools&&json)throw Error('Native tools cannot use constrained JSON mode');
  signal?.throwIfAborted();this.busy=true;const runtime=this.runtime,epoch=this.epoch,controller=new AbortController();this.controller=controller;const stop=()=>controller.abort();signal?.addEventListener('abort',stop,{once:true});const check=()=>{if(signal?.aborted||controller.signal.aborted||epoch!==this.epoch)throw Error('Stopped');};const start=this.clock();let first=null,text='',reasoning='',usage=null,timings=null,finishReason=null;
  // Only a completed operation in this same runtime may seed reuse. Native
  // token-prefix/checkpoint validation owns compatibility; never cache answers.
  const cachePrompt=this.reusePrompt&&this.promptCacheReady;this.promptCacheReady=false;
  try{check();this.onProgress('Generating');const stream=await runtime.createChatCompletion({messages,...this.templateOptions(!!tools),...(tools?{tools,tool_choice:'required'}:{}),max_tokens:maxTokens,...this.samplingOptions(),seed:0,cache_prompt:cachePrompt,stream:true,return_tokens:true,...(json?{response_format:{type:'json_object'}}:{}),...(jsonSchema?{json_schema:jsonSchema}:{}),abortSignal:controller.signal});
   const calls=new Map();let lastAnswerPreview='';
   for await(const chunk of stream){
    check();const choice=chunk.choices?.[0],delta=choice?.delta,content=delta?.content;
    if(typeof delta?.reasoning_content==='string'){
     reasoning+=delta.reasoning_content;
     checkStreamRepetition(reasoning,delta.reasoning_content,messages,controller);
     if(reasoning.length>32768)throw Error('Assistant reasoning exceeded transient context bound');
    }
    if(typeof choice?.finish_reason==='string'&&choice.finish_reason.length<=64)finishReason=choice.finish_reason;
    if(typeof content==='string'&&content.length){
     if(first===null&&content.trim())first=this.clock();
     text+=content;checkStreamRepetition(text,content,messages,controller);onContent(content);
    }
    if(Array.isArray(delta?.tool_calls))for(const part of delta.tool_calls){
     const index=part?.index;
     if(!Number.isSafeInteger(index)||index<0||index>=MAX_NATIVE_TOOL_CALLS)throw Error('Invalid native tool-call stream');
     let call=calls.get(index);
     if(!call){call={id:'',name:'',arguments:''};calls.set(index,call);}
     if(part.id!==undefined){
      if(typeof part.id!=='string'||part.id.length>256)throw Error('Invalid native tool-call ID');
      call.id=part.id;
     }
     const fn=part.function;
     if(fn?.name!==undefined){
      if(typeof fn.name!=='string'||fn.name.length>128)throw Error('Invalid native tool name');
      call.name+=fn.name;
     }
     if(fn?.arguments!==undefined){
      if(typeof fn.arguments!=='string'||call.arguments.length+fn.arguments.length>32768)throw Error('Invalid native tool arguments');
      call.arguments+=fn.arguments;checkStreamRepetition(call.arguments,fn.arguments,messages,controller);
     }
    }
    const preview=nativeAnswerPreview(calls);
    if(preview!==lastAnswerPreview){lastAnswerPreview=preview;onAnswerPreview(preview);}
    if(chunk.usage)usage=chunk.usage;
    if(chunk.timings)timings=chunk.timings;
   }
  check();this.promptCacheReady=this.reusePrompt;const totalMs=this.clock()-start;const inputTokens=usage?.prompt_tokens??(Number.isSafeInteger(timings?.prompt_n)&&Number.isSafeInteger(timings?.cache_n)?timings.prompt_n+timings.cache_n:timings?.prompt_n??null),outputTokens=usage?.completion_tokens??timings?.predicted_n??null;const toolCalls=[...calls.entries()].sort((a,b)=>a[0]-b[0]).map(([,call])=>{if(!call.name||!call.arguments)throw Error('Incomplete native tool call');let args;try{args=JSON.parse(call.arguments);}catch{throw Error('Invalid native tool arguments');}if(!args||typeof args!=='object'||Array.isArray(args)||Object.getPrototypeOf(args)!==Object.prototype)throw Error('Native tool arguments must be an object');return {id:call.id,name:call.name,arguments:args};});return {text,...(finishReason?{finishReason}:{}), ...(toolCalls.length?{toolCalls,...(reasoning?{assistantContent:'<think>'+reasoning+'</think>'+text}:{})}:{}),firstContentMs:first===null?null:first-start,totalMs,inputTokens,outputTokens,tokenCountSource:usage?'usage':timings?'runtime-timings':null,usage,timings,tokensPerSecond:outputTokens!==null&&totalMs>0?outputTokens/(totalMs/1000):null};
  }catch(error){this.promptCacheReady=false;const stopped=signal?.aborted||epoch!==this.epoch||controller.signal.aborted&&error?.code!=='repeated_output';controller.abort();if(stopped)throw Error('Stopped');throw error;}finally{signal?.removeEventListener('abort',stop);if(this.controller===controller)this.controller=null;this.busy=false;}
 }
 abort(){this.epoch++;this.promptCacheReady=false;this.controller?.abort();}
 async unload(){if(this.busy)throw Error('Stop active operation first');const runtime=this.runtime;this.promptCacheReady=false;this.runtime=null;this.loaded=null;this.info=null;if(runtime)await runtime.exit();}
}
export class LfmAdapter extends PreparedGgufAdapter {
 constructor(options){super({...options,architecture:'lfm2'});}
}
// Reuse is opt-in. The pinned native runtime checks exact token prefixes and
// restores recurrent/SWA checkpoints; changed or missing state is recomputed.
export class Lfm3Adapter extends PreparedGgufAdapter {
 constructor(options){super({...options,architecture:'lfm3'});Object.defineProperty(this,'nativeToolCalls',{value:true});}
}
