export type ProductRuntimeRole='text-onnx'|'text-wllama'|'text-lfm-check'|'decision'|'speech'|'vision'|'ocr'|'pdf'|'custom-tools';
export type ProductRuntimeProgress={status:'progress';role:ProductRuntimeRole;completed:number;total:number;bytes:number};
export type ProductRuntimeResult={status:'prepared';role:ProductRuntimeRole;assets:number;bytes:number};
type RuntimeReply=ProductRuntimeProgress|ProductRuntimeResult|{status:'failed';error:string};
type RuntimeWorker={postMessage:(message:unknown,transfer?:Transferable[])=>void};
type RuntimeOptions=NonNullable<Parameters<typeof prepareProductRuntimeAssets>[1]>;

export function runtimeRoleForModelEngine(engine:string|undefined|null):ProductRuntimeRole|null{
 if(engine==='transformers-causal-wasm'||engine==='transformers-causal-webgpu')return 'text-onnx';
 if(engine==='wllama-cpu-count'||engine==='wllama-qwen3-cpu'||engine==='wllama-qwen3'||engine==='wllama-lfm2')return 'text-wllama';
 return null;
}
export function runtimeRoleForPreparation(role:'text'|'decision'|'speech'|'vision'|'ocr'|'pdf'):ProductRuntimeRole|null{
 return role==='text'?null:role;
}

export function productRuntimeAssetInput(role:ProductRuntimeRole,allowNetwork:boolean){
 const labels:Record<ProductRuntimeRole,string>={'text-onnx':'ONNX text runtime','text-wllama':'GGUF text runtime','text-lfm-check':'LFM text checker',decision:'Decision runtime',speech:'Speech runtime',vision:'Vision runtime',ocr:'OCR runtime',pdf:'PDF reader runtime','custom-tools':'Custom tool runtime'};
 if(!Object.hasOwn(labels,role))throw Error('Unknown app runtime role');
 return {source:{name:labels[role]},role:'runtime',feature:role,runtime:{name:'BabelShelf app assets',revision:'build-pinned'},allowNetwork,method:allowNetwork?'explicit-preparation':'local-only'} as const;
}

/** Prepares only a build-pinned feature runtime through the controlled product worker. */
export function prepareProductRuntimeAssets(role:ProductRuntimeRole,options:{worker?:RuntimeWorker|null;signal?:AbortSignal;operationId?:string;onProgress?:(progress:ProductRuntimeProgress)=>void;makeChannel?:()=>MessageChannel}={}){
 const worker=options.worker===undefined?(typeof navigator!=='undefined'?navigator.serviceWorker?.controller:null):options.worker;
 if(!worker)return Promise.reject(Error('App runtime unavailable · reopen the installed app'));
 if(options.signal?.aborted)return Promise.reject(Error('Stopped'));
 const operationId=options.operationId??globalThis.crypto?.randomUUID?.()??`asset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
 const createChannel=options.makeChannel??(()=>new MessageChannel());
 let channel:MessageChannel;
 try{channel=createChannel();}catch{return Promise.reject(Error('App runtime messaging unavailable'));}
 return new Promise<ProductRuntimeResult>((resolve,reject)=>{
  let settled=false;
  const finish=(error?:Error,result?:ProductRuntimeResult)=>{if(settled)return;settled=true;options.signal?.removeEventListener('abort',abort);channel.port1.close();if(error)reject(error);else resolve(result!);};
  const abort=()=>{try{worker.postMessage({type:'cancel-product-assets',operationId},[]);}catch{}finish(Error('Stopped'));};
  channel.port1.onmessage=event=>{const reply=event.data;if(reply.status==='progress'){options.onProgress?.(reply);return;}if(reply.status==='failed'){finish(Error(reply.error));return;}finish(undefined,reply);};
  options.signal?.addEventListener('abort',abort,{once:true});
  try{worker.postMessage({type:'prepare-product-assets',role,operationId,acquire:true},[channel.port2]);}catch(error){finish(error instanceof Error?error:Error('Could not start app runtime preparation'));}
 });
}

/** Confirms an already cached feature runtime without permitting any network acquisition. */
export function verifyProductRuntimeAssets(role:ProductRuntimeRole,options:Omit<RuntimeOptions,'signal'|'onProgress'>={}){
 const worker=options.worker===undefined?(typeof navigator!=='undefined'?navigator.serviceWorker?.controller:null):options.worker;
 if(!worker)return Promise.reject(Error('App runtime unavailable · reopen the installed app'));
 const operationId=options.operationId??globalThis.crypto?.randomUUID?.()??`asset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
 let channel:MessageChannel;try{channel=options.makeChannel?.()??new MessageChannel();}catch{return Promise.reject(Error('App runtime messaging unavailable'));}
 return new Promise<ProductRuntimeResult>((resolve,reject)=>{
  let settled=false;const finish=(error?:Error,result?:ProductRuntimeResult)=>{if(settled)return;settled=true;channel.port1.close();if(error)reject(error);else resolve(result!);};
  channel.port1.onmessage=event=>{const reply=event.data;if(reply.status==='progress')return;if(reply.status==='failed')finish(Error(reply.error));else finish(undefined,reply);};
  try{worker.postMessage({type:'prepare-product-assets',role,operationId,acquire:false},[channel.port2]);}catch(error){finish(error instanceof Error?error:Error('Could not check app runtime'));}
 });
}
