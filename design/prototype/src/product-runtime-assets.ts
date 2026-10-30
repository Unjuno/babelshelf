export type ProductRuntimeRole='text-onnx'|'text-wllama'|'text-lfm3'|'text-lfm-check'|'decision'|'speech'|'vision'|'ocr'|'pdf'|'custom-tools';
export type ProductRuntimeProgress={status:'progress';role:ProductRuntimeRole;completed:number;total:number;bytes:number};
export type ProductRuntimeResult={status:'prepared';role:ProductRuntimeRole;assets:number;bytes:number};
type RuntimeReply=ProductRuntimeProgress|ProductRuntimeResult|{status:'failed';error:string};
type RuntimeWorker={postMessage:(message:unknown,transfer?:Transferable[])=>void};
type RuntimeOptions=NonNullable<Parameters<typeof prepareProductRuntimeAssets>[1]>;

// The GGUF stores validate and save local files without starting an inference worker.
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

type RuntimeRequestOptions={worker?:RuntimeWorker|null;signal?:AbortSignal;operationId?:string;onProgress?:(progress:ProductRuntimeProgress)=>void;makeChannel?:()=>MessageChannel;timeoutMs?:number};
/** Prepare or inspect only the selected, build-pinned runtime. */
function requestProductRuntime(role:ProductRuntimeRole,acquire:boolean,options:RuntimeRequestOptions){
 const worker=options.worker===undefined?(typeof navigator!=='undefined'?navigator.serviceWorker?.controller:null):options.worker;
 if(!worker)return Promise.reject(Error('App runtime unavailable · reopen the installed app'));
 if(options.signal?.aborted)return Promise.reject(Error('Stopped'));
 const operationId=options.operationId??globalThis.crypto?.randomUUID?.()??`asset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
 const timeoutMs=options.timeoutMs??(acquire?300000:60000);
 if(!Number.isFinite(timeoutMs)||timeoutMs<1)return Promise.reject(Error('Invalid runtime timeout'));
 let channel:MessageChannel;
 try{channel=options.makeChannel?.()??new MessageChannel();}catch{return Promise.reject(Error('App runtime messaging unavailable'));}
 return new Promise<ProductRuntimeResult>((resolve,reject)=>{
  let settled=false,timer:ReturnType<typeof setTimeout>;
  const cancel=()=>{try{worker.postMessage({type:'cancel-product-assets',operationId},[]);}catch{}};
  const finish=(error?:Error,result?:ProductRuntimeResult)=>{if(settled)return;settled=true;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);channel.port1.close();if(error)reject(error);else resolve(result!);};
  const abort=()=>{cancel();finish(Error('Stopped'));};
  const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{cancel();finish(Error('Runtime check timed out · retry'));},timeoutMs);};
  const invalid=()=>{cancel();finish(Error('Invalid app runtime response'));};
  channel.port1.onmessage=event=>{
   if(settled)return;
   const reply=event.data;
   if(!reply||typeof reply!=='object')return invalid();
   if(reply.status==='progress'){
    if(reply.role!==role||!Number.isSafeInteger(reply.completed)||!Number.isSafeInteger(reply.total)||reply.completed<0||reply.total<1||reply.total<reply.completed||!Number.isSafeInteger(reply.bytes)||reply.bytes<0)return invalid();
    arm();try{options.onProgress?.(reply);}catch{/* UI observers cannot strand the worker job. */}return;
   }
   if(reply.status==='failed'){if(typeof reply.error!=='string'||!reply.error)return invalid();finish(Error(reply.error));return;}
   if(reply.status!=='prepared'||reply.role!==role||!Number.isSafeInteger(reply.assets)||reply.assets<1||!Number.isSafeInteger(reply.bytes)||reply.bytes<0)return invalid();
   finish(undefined,reply);
  };
  options.signal?.addEventListener('abort',abort,{once:true});arm();
  try{worker.postMessage({type:'prepare-product-assets',role,operationId,acquire},[channel.port2]);}catch(error){finish(error instanceof Error?error:Error('Could not start app runtime preparation'));}
 });
}
/** Prepares only a build-pinned feature runtime through the controlled product worker. */
export function prepareProductRuntimeAssets(role:ProductRuntimeRole,options:RuntimeRequestOptions={}){
 return requestProductRuntime(role,true,options);
}
/** Confirms an already cached feature runtime without permitting any network acquisition. */
export function verifyProductRuntimeAssets(role:ProductRuntimeRole,options:Omit<RuntimeOptions,'signal'>={}){
 return requestProductRuntime(role,false,options);
}
