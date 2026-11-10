import {PlannerOutputError} from './planner-error.ts';
// A dedicated client for hard-stoppable WASM inference. No automatic replay after Stop.
const DEFAULT_LOAD_TIMEOUT_MS=30*60*1000;
const DEFAULT_LOAD_IDLE_TIMEOUT_MS=5*60*1000;
export function createIsolatedTextClient(worker:Worker,{disposeHandshake=false,initArgs={},loadTimeoutMs=DEFAULT_LOAD_TIMEOUT_MS,loadIdleTimeoutMs=DEFAULT_LOAD_IDLE_TIMEOUT_MS}:{disposeHandshake?:boolean;initArgs?:any;loadTimeoutMs?:number;loadIdleTimeoutMs?:number}={}){
 if(!Number.isSafeInteger(loadTimeoutMs)||loadTimeoutMs<1000||loadTimeoutMs>60*60*1000||!Number.isSafeInteger(loadIdleTimeoutMs)||loadIdleTimeoutMs<1000||loadIdleTimeoutMs>loadTimeoutMs)throw Error('Invalid text model load timeout');
 let seq=0,loaded:string|null=null,fault:Error|null=null;
 let disposeTimer:ReturnType<typeof setTimeout>|undefined,disposing=false,terminated=false;
 let finishDisposal:(()=>void)|undefined,rejectDisposal:((error:Error)=>void)|undefined,disposal:Promise<void>|undefined,cleanupConfirmed=true;
 const terminate=(confirmed=true)=>{if(disposeTimer)clearTimeout(disposeTimer);cleanupConfirmed&&=confirmed;if(!terminated){terminated=true;try{worker.terminate();}catch{cleanupConfirmed=false;}}if(cleanupConfirmed)finishDisposal?.();else rejectDisposal?.(Error('Worker cleanup not confirmed'));};
 const pending=new Map<number,{resolve:(value:any)=>void;reject:(reason:Error)=>void;events?:any}>();
 function fail(error:Error){fault=error;loaded=null;for(const item of pending.values())item.reject(error);pending.clear();}
 worker.onmessage=({data})=>{if(disposing&&data.id===0&&data.type==='disposed'){terminate(data.cleanupFailed!==true);return;}const item=pending.get(data.id);if(!item)return;if(data.type==='done'||data.type==='error'){pending.delete(data.id);if(data.type==='done')item.resolve(data.value);else{const d=data.diagnostic;let error:Error;if(d&&typeof d.raw==='string'&&d.raw.length<=8192&&typeof d.reason==='string'&&d.reason.length<=100&&typeof d.truncated==='boolean'){const planned=new PlannerOutputError(String(data.value),d.raw,d.reason);planned.diagnostic.truncated=d.truncated;error=planned;}else error=Error(data.value);if(Number.isSafeInteger(data.downloadedBytes)&&data.downloadedBytes>=0)Object.assign(error,{downloadedBytes:data.downloadedBytes});item.reject(error);}}else item.events?.(data.type,data.value);};
 worker.onerror=worker.onmessageerror=()=>{fail(Error('Text worker stopped'));terminate(!disposeHandshake);};
 const call=(cmd:string,args:any={},events?:any):Promise<any>=>{
  if(fault)return Promise.reject(fault);
  return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject,events});try{worker.postMessage({id,cmd,args});}catch(error){pending.delete(id);reject(error);}});
 };
 function abort(){if(disposal)return disposal;disposal=new Promise<void>((resolve,reject)=>{finishDisposal=resolve;rejectDisposal=reject;});void disposal.catch(()=>{});if(terminated){terminate(cleanupConfirmed);return disposal;}if(!fault)fail(Error('Stopped'));if(disposeHandshake){disposing=true;disposeTimer=setTimeout(()=>terminate(false),1000);try{worker.postMessage({id:0,cmd:'dispose'});}catch{terminate(false);}}else terminate();return disposal;}
 return {manifest:{},worker:{terminate:abort},get failed(){return !!fault;},get loaded(){return loaded;},init:()=>call('init',initArgs),call,
 async load(id:string,events?:any){
  loaded=null;let hardTimer:ReturnType<typeof setTimeout>|undefined,idleTimer:ReturnType<typeof setTimeout>|undefined,rejectTimeout:(error:Error)=>void=()=>{};
  const timeout=new Promise<never>((_resolve,reject)=>{rejectTimeout=reject;});
  const failLoad=(message:string,code:'text_model_load_timeout'|'text_model_load_stalled')=>{const error=Object.assign(Error(message),{code});rejectTimeout(error);};
  const minutes=(value:number)=>Math.max(1,Math.ceil(value/60000));
  const resetIdle=()=>{if(idleTimer)clearTimeout(idleTimer);const limit=minutes(loadIdleTimeoutMs);idleTimer=setTimeout(()=>failLoad(`No model-load progress for ${limit} minute${limit===1?'':'s'} · worker stopped`, 'text_model_load_stalled'),loadIdleTimeoutMs);};
  const hardLimit=minutes(loadTimeoutMs);hardTimer=setTimeout(()=>failLoad(`Model load exceeded ${hardLimit} minute${hardLimit===1?'':'s'} · worker stopped`,'text_model_load_timeout'),loadTimeoutMs);resetIdle();
  try{
   const loading=call('load',{model:id},(type:string,value:unknown)=>{if(type==='progress')resetIdle();events?.(type,value);});
   const metrics=await Promise.race([loading,timeout]);if(fault)throw fault;loaded=id;return metrics;
  }catch(error){
   if(error&&typeof error==='object'&&((error as {code?:unknown}).code==='text_model_load_timeout'||(error as {code?:unknown}).code==='text_model_load_stalled')){fail(error as Error);void abort();}
   throw error;
  }finally{if(hardTimer)clearTimeout(hardTimer);if(idleTimer)clearTimeout(idleTimer);}
 },
 async unload(){await call('unload');loaded=null;},abort};
}
