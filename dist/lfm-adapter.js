import {hashLocalModel} from './local-models.js';
// App-owned prepared-file adapter. Never uses URL/HF download methods.
export class LfmAdapter {
 constructor({Wllama,paths,compat,models,clock=()=>performance.now(),logger=console}){if(!paths?.default||!compat?.wasm||!compat?.worker)throw Error('Local runtime assets required');this.Wllama=Wllama;this.paths=paths;this.compat=compat;this.models=models;this.clock=clock;this.logger=logger;this.runtime=null;this.busy=false;this.epoch=0;}
 async load(file,id,{backend,signal}={}){
  if(this.busy||this.runtime)throw Error('Unload model first');if(!['cpu','webgpu'].includes(backend))throw Error('Select explicit backend');const model=this.models.find(m=>m.id===id);if(!model)throw Error('Unknown LFM model');this.busy=true;const loadStart=this.clock(),epoch=this.epoch,check=()=>{signal?.throwIfAborted();if(epoch!==this.epoch)throw Error('Stopped');};let runtime;
  try{check();if(file.size!==model.file.bytes||await hashLocalModel(file,{signal})!==model.file.sha256)throw Error('Model integrity mismatch');check();
   if(backend==='webgpu'&&(!globalThis.navigator?.gpu||!await navigator.gpu.requestAdapter()))throw Error('WebGPU unavailable');check();
   runtime=new this.Wllama(this.paths,{logger:this.logger});runtime.setCompat(this.compat);this.runtime=runtime;const start=this.clock();
   await runtime.loadModel([file],{n_ctx:2048,n_threads:1,n_gpu_layers:backend==='cpu'?0:99999,n_parallel:1,n_batch:128,n_ubatch:128,cache_idle_slots:false,n_cache_reuse:0,warmup:false,seed:0});check();
   const template=runtime.getChatTemplate();if(typeof template!=='string'||!template.trim())throw Error('GGUF chat template missing');const context=runtime.getLoadedContextInfo();if(context.metadata?.['general.architecture']!=='lfm2')throw Error('Unexpected GGUF architecture');
   this.loaded=id;this.info={model:id,backend,actualGpuLayers:backend==='cpu'?0:null,loadMs:this.clock()-loadStart,runtimeLoadMs:this.clock()-start,verificationMs:start-loadStart,context,template,workerResources:{compat:runtime.getWorkerResources().compat,wasmPath:runtime.getWorkerResources().wasmPath},runtimeVersion:this.Wllama.getLibllamaVersion()};return this.info;
  }catch(error){await runtime?.exit().catch(()=>{});this.runtime=null;this.loaded=null;if(signal?.aborted||epoch!==this.epoch)throw Error('Stopped');throw error;}finally{this.busy=false;}
 }
 async generate(messages,{signal,maxTokens=256,onContent=()=>{},json=true}={}){
  if(this.busy||!this.runtime||!this.loaded)throw Error('Model not ready');if(!Number.isInteger(maxTokens)||maxTokens<1||maxTokens>256)throw Error('Output budget exceeded');if(!Array.isArray(messages)||messages.some(m=>!['system','user','assistant'].includes(m.role)||typeof m.content!=='string'))throw Error('Invalid messages');
  signal?.throwIfAborted();this.busy=true;const runtime=this.runtime,epoch=this.epoch,controller=new AbortController();this.controller=controller;const stop=()=>controller.abort();signal?.addEventListener('abort',stop,{once:true});const check=()=>{if(signal?.aborted||controller.signal.aborted||epoch!==this.epoch)throw Error('Stopped');};const start=this.clock();let first=null,text='',usage=null,timings=null;
  try{check();const stream=await runtime.createChatCompletion({messages,max_tokens:maxTokens,temperature:0,seed:0,cache_prompt:false,stream:true,return_tokens:true,...(json?{response_format:{type:'json_object'}}:{}),abortSignal:controller.signal});
   for await(const chunk of stream){check();const content=chunk.choices?.[0]?.delta?.content;if(typeof content==='string'&&content.length){if(first===null&&content.trim())first=this.clock();text+=content;onContent(content);}if(chunk.usage)usage=chunk.usage;if(chunk.timings)timings=chunk.timings;}
   check();const totalMs=this.clock()-start;const inputTokens=usage?.prompt_tokens??timings?.prompt_n??null,outputTokens=usage?.completion_tokens??timings?.predicted_n??null;return {text,firstContentMs:first===null?null:first-start,totalMs,inputTokens,outputTokens,tokenCountSource:usage?'usage':timings?'runtime-timings':null,usage,timings,tokensPerSecond:outputTokens!==null&&totalMs>0?outputTokens/(totalMs/1000):null};
  }catch(error){if(signal?.aborted||controller.signal.aborted||epoch!==this.epoch)throw Error('Stopped');throw error;}finally{signal?.removeEventListener('abort',stop);if(this.controller===controller)this.controller=null;this.busy=false;}
 }
 abort(){this.epoch++;this.controller?.abort();}
 async unload(){if(this.busy)throw Error('Stop active operation first');const runtime=this.runtime;this.runtime=null;this.loaded=null;this.info=null;if(runtime)await runtime.exit();}
}
