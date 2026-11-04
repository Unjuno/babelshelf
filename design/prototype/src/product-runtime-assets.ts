export type ProductRuntimeRole='text-onnx'|'text-wllama'|'text-lfm3'|'text-lfm-check'|'decision'|'speech'|'vision'|'ocr'|'pdf'|'custom-tools';
export type ProductRuntimeProgress={status:'progress';role:ProductRuntimeRole;completed:number;total:number;bytes:number;totalBytes?:number};
export type ProductRuntimeResult={status:'prepared';role:ProductRuntimeRole;assets:number;bytes:number;downloadedBytes?:number};
/** Show useful movement while one large runtime asset is still streaming. */
export function productRuntimeProgressLabel(progress:ProductRuntimeProgress){
 if(!Number.isSafeInteger(progress.completed)||progress.completed<0||!Number.isSafeInteger(progress.total)||progress.total<1||progress.completed>progress.total||!Number.isSafeInteger(progress.bytes)||progress.bytes<0||(progress.totalBytes!==undefined&&(!Number.isSafeInteger(progress.totalBytes)||progress.totalBytes<1||progress.bytes>progress.totalBytes)))throw Error('Invalid runtime progress');
 const megabytes=Math.floor(progress.bytes/100000)/10;
 if(progress.totalBytes===undefined)return `Runtime · ${progress.completed}/${progress.total} · ${megabytes.toFixed(1)} MB read`;
 const totalMegabytes=Math.floor(progress.totalBytes/100000)/10,percent=Math.min(100,Math.floor(progress.bytes/progress.totalBytes*100));
 return `Runtime · ${percent}% · ${megabytes.toFixed(1)} / ${totalMegabytes.toFixed(1)} MB`;
}
export const PRODUCT_RUNTIME_FAILURE_CODES=['invalid-request','runtime-unavailable','runtime-messaging-unavailable','runtime-invalid-response','runtime-timeout','runtime-assets-unavailable','runtime-not-prepared','downloads-off','runtime-http-error','runtime-network-error','runtime-integrity-error','runtime-storage-error','runtime-setup-error','stopped'] as const;
export type ProductRuntimeFailureCode=typeof PRODUCT_RUNTIME_FAILURE_CODES[number];
type RuntimeReply=ProductRuntimeProgress|ProductRuntimeResult|{status:'failed';error:string;code?:ProductRuntimeFailureCode;downloadedBytes?:number};
type RuntimeWorker={postMessage:(message:unknown,transfer?:Transferable[])=>void};
type RuntimeOptions=NonNullable<Parameters<typeof prepareProductRuntimeAssets>[1]>;

/** Only a confirmed cache miss justifies the Full-cycle transition from local verification to acquisition. */
export function shouldAcquireRuntimeAfterVerification(error:unknown,downloads:boolean,online:boolean){
 const code=error&&typeof error==='object'?'code' in error?(error as {code?:unknown}).code:undefined:undefined;
 return downloads&&online&&code==='runtime-not-prepared';
}

// Runtime files are a separate prerequisite and must be ready before model
// acquisition begins. Local GGUF imports remain storage-only; runtime is still
// checked before the model can execute.
export async function prepareTextAssets(options:{role:ProductRuntimeRole|null;downloads:boolean;verifyOnly:boolean;hasLocalFiles:boolean;ensureRuntime:(role:ProductRuntimeRole,allowNetwork:boolean)=>Promise<unknown>;prepare:()=>Promise<unknown>;verify:()=>Promise<unknown>}){
 const localGguf=(options.verifyOnly||options.hasLocalFiles&&!options.downloads)&&(options.role==='text-lfm3'||options.role==='text-wllama');
 if(options.role&&!localGguf)await options.ensureRuntime(options.role,options.downloads&&!options.verifyOnly);
 if(options.verifyOnly)await options.verify();else await options.prepare();
}

export function runtimeRoleForModelEngine(engine:string|undefined|null):ProductRuntimeRole|null{
 if(engine==='transformers-causal-wasm'||engine==='transformers-causal-webgpu')return 'text-onnx';
 if(engine==='wllama-cpu-count'||engine==='wllama-qwen3-cpu'||engine==='wllama-qwen3'||engine==='wllama-lfm2')return 'text-wllama';
 if(engine==='wllama-lfm3')return 'text-lfm3';
 return null;
}
export function runtimeRoleForPreparation(role:'text'|'decision'|'speech'|'vision'|'ocr'|'pdf'):ProductRuntimeRole|null{
 return role==='text'?null:role;
}

export function productRuntimeAssetInput(role:ProductRuntimeRole,allowNetwork:boolean){
 const labels:Record<ProductRuntimeRole,string>={'text-onnx':'ONNX text runtime','text-wllama':'GGUF text runtime','text-lfm3':'LFM3 WebGPU runtime','text-lfm-check':'LFM text checker',decision:'Decision runtime',speech:'Speech runtime',vision:'Vision runtime',ocr:'OCR runtime',pdf:'PDF reader runtime','custom-tools':'Custom tool runtime'};
 if(!Object.hasOwn(labels,role))throw Error('Unknown app runtime role');
 return {source:{name:labels[role]},role:'runtime',feature:role,runtime:{name:'BabelShelf app assets',revision:'build-pinned'},allowNetwork,method:allowNetwork?'explicit-preparation':'local-only'} as const;
}

type RuntimeRequestOptions={worker?:RuntimeWorker|null;signal?:AbortSignal;operationId?:string;onProgress?:(progress:ProductRuntimeProgress)=>void;makeChannel?:()=>MessageChannel;timeoutMs?:number;maxDurationMs?:number};
/** Prepare or inspect only the selected, build-pinned runtime. */
function requestProductRuntime(role:ProductRuntimeRole,acquire:boolean,options:RuntimeRequestOptions){
 const worker=options.worker===undefined?(typeof navigator!=='undefined'?navigator.serviceWorker?.controller:null):options.worker;
 const codedError=(message:string,code:ProductRuntimeFailureCode)=>Object.assign(Error(message),{code});
 if(!worker)return Promise.reject(codedError('App runtime unavailable · reopen the installed app','runtime-unavailable'));
 if(options.signal?.aborted)return Promise.reject(codedError('Stopped','stopped'));
 const operationId=options.operationId??globalThis.crypto?.randomUUID?.()??`asset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
 const timeoutMs=options.timeoutMs??(acquire?300000:60000);
 const maxDurationMs=options.maxDurationMs??(acquire?600000:180000);
 if(!Number.isFinite(timeoutMs)||timeoutMs<1||!Number.isFinite(maxDurationMs)||maxDurationMs<1)return Promise.reject(codedError('Invalid runtime timeout','runtime-setup-error'));
 let channel:MessageChannel;
 try{channel=options.makeChannel?.()??new MessageChannel();}catch{return Promise.reject(codedError('App runtime messaging unavailable','runtime-messaging-unavailable'));}
 return new Promise<ProductRuntimeResult>((resolve,reject)=>{
  let settled=false,watchdog:ReturnType<typeof setTimeout>,idleDeadline=Date.now()+timeoutMs;
  const maxDeadline=Date.now()+maxDurationMs;
  const cancel=()=>{try{worker.postMessage({type:'cancel-product-assets',operationId},[]);}catch{}};
  const onResume=()=>{if(!expireIfDue())armWatchdog();};
  const finish=(error?:Error,result?:ProductRuntimeResult)=>{if(settled)return;settled=true;clearTimeout(watchdog);options.signal?.removeEventListener('abort',abort);if(typeof document!=='undefined')document.removeEventListener('visibilitychange',onResume);if(typeof window!=='undefined')window.removeEventListener('focus',onResume);channel.port1.close();if(error)reject(error);else resolve(result!);};
  const abort=()=>{cancel();finish(codedError('Stopped','stopped'));};
  const expireIfDue=()=>{
   const now=Date.now();
   if(now>=maxDeadline){cancel();finish(codedError('Runtime preparation exceeded the maximum duration · retry','runtime-timeout'));return true;}
   if(now>=idleDeadline){cancel();finish(codedError('Runtime check timed out · retry','runtime-timeout'));return true;}
   return false;
  };
  const armWatchdog=()=>{if(settled)return;clearTimeout(watchdog);const remaining=Math.max(0,Math.min(idleDeadline,maxDeadline)-Date.now());watchdog=setTimeout(()=>{if(!expireIfDue())armWatchdog();},remaining);};
  const arm=()=>{idleDeadline=Date.now()+timeoutMs;armWatchdog();};
  const invalid=()=>{cancel();finish(codedError('Invalid app runtime response','runtime-invalid-response'));};
  channel.port1.onmessage=event=>{
   if(settled)return;
   if(expireIfDue())return;
   const reply=event.data;
   if(!reply||typeof reply!=='object')return invalid();
    if(reply.status==='progress'){
    if(reply.role!==role||!Number.isSafeInteger(reply.completed)||!Number.isSafeInteger(reply.total)||reply.completed<0||reply.total<1||reply.total<reply.completed||!Number.isSafeInteger(reply.bytes)||reply.bytes<0||(reply.totalBytes!==undefined&&(!Number.isSafeInteger(reply.totalBytes)||reply.totalBytes<1||reply.bytes>reply.totalBytes)))return invalid();
    arm();try{options.onProgress?.(reply);}catch{/* UI observers cannot strand the worker job. */}return;
   }
   if(reply.status==='failed'){if(typeof reply.error!=='string'||!reply.error||(reply.code!==undefined&&!PRODUCT_RUNTIME_FAILURE_CODES.includes(reply.code))||(reply.downloadedBytes!==undefined&&(!Number.isSafeInteger(reply.downloadedBytes)||reply.downloadedBytes<0)))return invalid();const error=codedError(reply.error,reply.code??'runtime-setup-error');if(reply.downloadedBytes!==undefined)Object.assign(error,{downloadedBytes:reply.downloadedBytes});finish(error);return;}
   if(reply.status!=='prepared'||reply.role!==role||!Number.isSafeInteger(reply.assets)||reply.assets<1||!Number.isSafeInteger(reply.bytes)||reply.bytes<0||(reply.downloadedBytes!==undefined&&(!Number.isSafeInteger(reply.downloadedBytes)||reply.downloadedBytes<0||reply.downloadedBytes>reply.bytes)))return invalid();
   finish(undefined,reply);
  };
  options.signal?.addEventListener('abort',abort,{once:true});
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',onResume);
  if(typeof window!=='undefined')window.addEventListener('focus',onResume);
  armWatchdog();
  try{worker.postMessage({type:'prepare-product-assets',role,operationId,acquire},[channel.port2]);}catch(error){finish(codedError(error instanceof Error?error.message:'Could not start app runtime preparation','runtime-messaging-unavailable'));}
 });
}
/** Prepares only a build-pinned feature runtime through the controlled product worker. */
export function prepareProductRuntimeAssets(role:ProductRuntimeRole,options:RuntimeRequestOptions={}){
 return requestProductRuntime(role,true,options);
}
/** Confirms an already cached feature runtime without permitting any network acquisition. */
export function verifyProductRuntimeAssets(role:ProductRuntimeRole,options:RuntimeRequestOptions={}){
 return requestProductRuntime(role,false,options);
}
