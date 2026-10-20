import {withLocalModels,verifyLocalModelFile} from './local-model-manifest.js';
import {hashLocalModel} from './local-models.js';
import {adapterSnapshot} from './gpu-info.js';
import {createStreamingSHA256,streamingSHA256Backend} from './streaming-sha256.js';
import {fileResponse} from './ranges.js';
const networkFetch=globalThis.fetch.bind(globalThis);
// Inference never has a network fallback, even when update permission is ON.
globalThis.fetch=()=>Promise.reject(Error('Network disabled for inference'));
let manifest,baseManifest,model,session,controller,busy=false,root,loadedModelInfo=null;
const send=(id,type,value)=>postMessage({id,type,value});
async function directory(){return root??=await (await navigator.storage.getDirectory()).getDirectoryHandle('mlb-assets-v1',{create:true});}
async function file(name){return (await (await directory()).getFileHandle(name)).getFile();}
async function meta(id){try{return JSON.parse(await (await file('ready-'+id+'.json')).text());}catch{return null;}}
async function writeJSON(name,value){const w=await(await(await directory()).getFileHandle(name,{create:true})).createWritable();await w.write(JSON.stringify(value));await w.close();}
async function hashFile(f,notify=()=>{}){return hashLocalModel(f,{signal:controller?.signal,progress:(bytes,total)=>notify(bytes/total)});}
async function storeAsset(entry,id,local=null){
 const name=entry.sha256;try{const f=await file(name);if(f.size===entry.bytes&&await hashFile(f)===entry.sha256)return name;}catch{controller?.signal.throwIfAborted();}
 controller?.signal.throwIfAborted();
 const h=await createStreamingSHA256();controller?.signal.throwIfAborted();
 const handle=await(await directory()).getFileHandle(name,{create:true}),w=await handle.createWritable();let count=0,last=0,yieldBytes=0;let reader,cancellation;
 const cancel=()=>cancellation??=reader?.cancel().catch(()=>{});const abort=()=>{void cancel();};
 try{
  if(local){if(local.size!==entry.bytes)throw Error('File size mismatch');reader=local.stream().getReader();}
  else {const res=await networkFetch(entry.url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});if(!res.ok||!res.body)throw Error('Download failed · HTTP '+res.status);reader=res.body.getReader();}
  controller.signal.throwIfAborted();controller.signal.addEventListener('abort',abort,{once:true});
  while(true){controller.signal.throwIfAborted();const {value,done}=await reader.read();controller.signal.throwIfAborted();if(done)break;count+=value.length;if(count>entry.bytes)throw Error('Unexpected file size');h.update(value);await w.write(value);yieldBytes+=value.length;if(yieldBytes>=1048576){yieldBytes=0;await new Promise(resolve=>setTimeout(resolve,0));controller.signal.throwIfAborted();}if(Date.now()-last>300){send(id,'progress',`${entry.name} · ${(count/1e6).toFixed(1)} / ${(entry.bytes/1e6).toFixed(1)} MB`);last=Date.now();}}
  controller.signal.throwIfAborted();if(count!==entry.bytes||h.hex()!==entry.sha256)throw Error('Verification failed');await w.close();return name;
 }catch(e){await cancel();await w.abort().catch(()=>{});try{await(await directory()).removeEntry(name);}catch{}throw e;}
 finally{controller.signal.removeEventListener('abort',abort);await cancel();reader?.releaseLock();}
}
async function status(){const out={};for(const m of manifest.models){const x=await meta(m.id);if(x){try{const a=await file(x.modelHash),r=await file(x.runtimeHash);out[m.id]={...x,filesPresent:a.size===m.file.bytes&&r.size===manifest.runtime.file.bytes};}catch{out[m.id]={...x,filesPresent:false};}}else out[m.id]=null;}return out;}
async function verifyStored(id,size){
 const m=manifest.models.find(m=>m.id===size);if(!m)throw Error('Unsupported model');
 const f=await file(m.file.sha256),runtime=await file(manifest.runtime.file.sha256);
 send(id,'progress','Verifying…');
 if(m.localModel)await verifyLocalModelFile(f,m.localModel,{signal:controller.signal,progress:(n,total)=>send(id,'progress','Verifying model · '+Math.round(n/total*100)+'%')});
 if(f.size!==m.file.bytes||runtime.size!==manifest.runtime.file.bytes||(!m.localModel&&(await hashFile(f,p=>send(id,'progress','Verifying model · '+Math.round(p*100)+'%'))!==m.file.sha256))||await hashFile(runtime)!==manifest.runtime.file.sha256)throw Error('Local verification failed');
 controller.signal.throwIfAborted();return {f,runtime};
}
async function load(id,size){
 const started=performance.now();
 const m=manifest.models.find(m=>m.id===size);if(!m)throw Error('Unsupported model');const ready=await meta(size);if(!ready)throw Error('Model not downloaded');
 await unload();controller.signal.throwIfAborted();
 const verifyStarted=performance.now(),{f,runtime}=await verifyStored(id,size),verificationMs=performance.now()-verifyStarted;
 send(id,'progress','Loading…');
 const moduleURL=URL.createObjectURL(new Blob([runtime],{type:'text/javascript'}));let api;
 const importStarted=performance.now();try{api=await import(moduleURL);}finally{URL.revokeObjectURL(moduleURL);}const importMs=performance.now()-importStarted;
 const localURL=new URL('__model/'+m.file.name,self.location.href).href;
 const localFetch=async(url,options={})=>{if(String(url)!==localURL)throw Error('Blocked resource: '+url);return fileResponse(f,options);};
 const loadStarted=performance.now();model=await api.Qwen3_5ForConditionalGeneration.from_pretrained(localURL,{mmproj:null,fetch:localFetch,cache:false,maxLength:manifest.contextTokens,prefixSnapshotStore:null,decodePipelineDepth:1,signal:controller.signal,chatTemplateArgs:{enable_thinking:false},onProgress:p=>send(id,'progress',p.message??p.status)});const runtimeLoadMs=performance.now()-loadStarted;
 controller.signal.throwIfAborted();session=model.create_session();loadedModelInfo={model:size,revision:m.revision,runtimeRevision:manifest.runtime.revision,quantization:m.localModel?{container:'GGUF',tensorTypes:m.localModel.inspection.tensorTypes}:m.format,contextTokens:model.contextLength};const loadedModel=model;model.lost.then(e=>{if(model!==loadedModel)return;send(0,'lost',String(e?.message??e));model=null;session=null;loadedModelInfo=null;});
 return {...loadedModelInfo,device:model.deviceInfo(),memory:model.memoryStats(),timings:{verificationMs,importMs,runtimeLoadMs,totalLoadMs:performance.now()-started,hashBackend:streamingSHA256Backend(),decodePipelineDepth:1}};
}
async function unload(){
 const oldSession=session,oldModel=model;session=null;model=null;loadedModelInfo=null;
 const errors=[];try{await oldSession?.dispose();}catch(error){errors.push(error);}try{await oldModel?.dispose();}catch(error){errors.push(error);}
 if(errors.length)throw errors.length===1?errors[0]:new AggregateError(errors,'Model cleanup failed');
}
onmessage=async({data})=>{
 const {id,cmd,args={}}=data;
 if(cmd==='abort'){controller?.abort(new DOMException('Stopped','AbortError'));return;}
 if(busy){send(id,'error','Busy');return;}busy=true;controller=new AbortController();
 try{
  let result;
  switch(cmd){
   case 'init':if(baseManifest)throw Error('Worker already initialized');baseManifest=structuredClone(args.manifest);manifest=withLocalModels(baseManifest);result=await status();break;
   case 'configure':{if(!baseManifest)throw Error('Worker not initialized');if(model||session)throw Error('Unload model before registry changes');const next=withLocalModels(baseManifest,args.models);manifest=next;result=await status();break;}
   case 'status':result=await status();break;
   case 'verify':await verifyStored(id,args.model);result=true;break;
   case 'probe':{if(!navigator.gpu){result={available:false,reason:'WebGPU API unavailable in this Worker'};break;}const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});result=adapter?adapterSnapshot(adapter):{available:false,reason:'No WebGPU adapter was returned'};break;}

   case 'prepare':{
    const m=manifest.models.find(m=>m.id===args.model);if(!m)throw Error('Unsupported model');if(!m.localModel&&!args.localFiles&&!args.allowNetwork)throw Error('Downloads are off');
    if(m.localModel){
     if(args.allowNetwork)throw Error('Custom models require local files');
     const local=args.modelFile;if(!local)throw Error('Local model file required');
     await verifyLocalModelFile(local,m.localModel,{signal:controller.signal,progress:(n,total)=>send(id,'progress','Verifying model · '+Math.round(n/total*100)+'%')});
     const supplied=(args.localFiles??[]).find(f=>f.name===manifest.runtime.file.name||f.name===manifest.runtime.file.sha256);
     if(supplied){if(supplied.size!==manifest.runtime.file.bytes||await hashLocalModel(supplied,{signal:controller.signal})!==manifest.runtime.file.sha256)throw Error('Runtime verification failed');await storeAsset(manifest.runtime.file,id,supplied);}
     else {let cached;try{cached=await file(manifest.runtime.file.sha256);}catch{throw Error('Verified runtime.js required');}if(cached.size!==manifest.runtime.file.bytes||await hashLocalModel(cached,{signal:controller.signal})!==manifest.runtime.file.sha256)throw Error('Verified runtime.js required');}
     await storeAsset(m.file,id,local);controller.signal.throwIfAborted();
     const ready={model:m.id,modelHash:m.file.sha256,runtimeHash:manifest.runtime.file.sha256,verifiedAt:new Date().toISOString(),generationVerified:false,offlineVerified:false};await writeJSON('ready-'+m.id+'.json',ready);result=ready;break;
    }
    const files=args.localFiles??[];const match=e=>files.find(f=>f.name===e.name||f.name===e.sha256);
    if(args.localFiles&&(!match(m.file)||!match(manifest.runtime.file)))throw Error('Model GGUF and runtime.js required');
    await storeAsset(manifest.runtime.file,id,match(manifest.runtime.file));await storeAsset(m.file,id,match(m.file));
    const ready={model:m.id,modelHash:m.file.sha256,runtimeHash:manifest.runtime.file.sha256,verifiedAt:new Date().toISOString(),generationVerified:false,offlineVerified:false};await writeJSON('ready-'+m.id+'.json',ready);result=ready;break;
   }
   case 'load':result=await load(id,args.model);break;
   case 'unload':await unload();result=true;break;
   case 'count':if(!session)throw Error('Model not loaded');result=session.count_tokens(args.messages,{enable_thinking:false});break;
   case 'generate':{
    if(!session)throw Error('Model not loaded');
    if(args.profile!==undefined&&!['greedy','bonsai-nonthinking'].includes(args.profile))throw Error('Unsupported generation profile');
    if(args.seed!==undefined&&(!Number.isSafeInteger(args.seed)||args.seed<0||args.seed>4294967295))throw Error('Invalid sampling seed');
    if(args.decodePipelineDepth!==undefined&&![1,4].includes(args.decodePipelineDepth))throw Error('Unsupported diagnostic decode pipeline');
    if(args.resetSession===true)session.reset();
    const countStarted=performance.now(),count=session.count_tokens(args.messages,{enable_thinking:false}),countMs=performance.now()-countStarted;if(count.prompt_tokens+args.maxTokens>model.contextLength)throw Error(`Context limit · ${count.prompt_tokens} tokens`);
    const start=performance.now();let first=null,last=null,text='',chunks=0;
    const sampling=args.profile==='bonsai-nonthinking'?{do_sample:true,temperature:.7,top_p:.8,top_k:20,min_p:0,seed:args.seed??0}:{do_sample:false};
    const memoryBefore=model.memoryStats?.()??null;
    const stream=session.generate(args.messages,{max_new_tokens:args.maxTokens??256,enable_thinking:false,...sampling,...(args.decodePipelineDepth!==undefined?{decode_pipeline_depth:args.decodePipelineDepth}:{}),signal:controller.signal});
    for await(const event of stream){if(event.type==='text'){text+=event.text;first??=performance.now();last=performance.now();chunks++;send(id,'text',event.text);}else if(event.type==='prefill')send(id,'progress',`Prefill · ${event.done} / ${event.total}`);}
    const raw=await stream.result,elapsedMs=performance.now()-start,outputTokens=raw?.usage?.completion_tokens,reported=key=>Number.isFinite(raw?.timings?.[key])&&raw.timings[key]>=0?raw.timings[key]:null;
    result={text,inputTokens:count.prompt_tokens,ttftMs:first===null?null:first-start,elapsedMs,textChunks:chunks,rawSummary:raw?Object.keys(raw):[],finishReason:raw?.finish_reason,outputTokens,usage:raw?.usage,stopped:controller.signal.aborted,metrics:{identity:loadedModelInfo,device:model.deviceInfo?.()??null,countMs,visibleTextTtftMs:first===null?null:first-start,lastVisibleTextMs:last===null?null:last-start,generationMs:elapsedMs,outputTokens:Number.isSafeInteger(outputTokens)?outputTokens:null,generationTokensPerSecond:Number.isSafeInteger(outputTokens)&&outputTokens>0&&elapsedMs>0?outputTokens*1000/elapsedMs:null,runtimeTtftMs:reported('ttft_ms'),runtimeDecodeMs:reported('decode_ms'),runtimeDecodeTokensPerSecond:reported('tokens_per_second'),memoryBefore,memoryAfter:model.memoryStats?.()??null,decodePipelineDepth:args.decodePipelineDepth??1,samplingProfile:args.profile??'greedy'}};break;
   }
   default:throw Error('Unknown action');
  }
  send(id,'done',result);
 }catch(e){if(cmd==='load')try{await unload();}catch(cleanup){e=new AggregateError([e,cleanup],'Model load and cleanup failed');}send(id,'error',e?.name==='AbortError'?'Stopped':String(e?.message??e));}finally{busy=false;controller=null;}
};
