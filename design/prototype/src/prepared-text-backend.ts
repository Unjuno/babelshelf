import type {TextBackend} from './text-engine-router.ts';
type Store={status:(signal:AbortSignal)=>Promise<any>;verify:(signal:AbortSignal)=>Promise<void>;prepare:(allowNetwork:boolean,signal:AbortSignal,progress:(done:number,total:number)=>void,files:File[])=>Promise<void>};
export async function collectPreparedTextStatuses(stores:Iterable<[string,Pick<Store,'status'>]>,signal:AbortSignal){const result:Record<string,any>={};for(const [id,store]of stores){try{result[id]={...await store.status(signal),presenceOnly:true};}catch{signal.throwIfAborted();result[id]={filesPresent:false,presenceOnly:true,statusError:true};}signal.throwIfAborted();}return result;}
// Asset authority belongs to this app-owned controller, never the inference worker.
export function createPreparedTextBackend({manifest,stores,createClient}:{manifest:any;stores:ReadonlyMap<string,Store>;createClient:()=>TextBackend}):TextBackend{
 const fixed=structuredClone(manifest),owned=new Map(stores);
 if(!Array.isArray(fixed.models)||!fixed.models.length||fixed.models.some((m:any)=>!owned.has(m.id))||new Set(fixed.models.map((m:any)=>m.id)).size!==fixed.models.length||owned.size!==fixed.models.length)throw Error('Invalid prepared text backend');
 let client:TextBackend|null=null,busy=false,controller:AbortController|null=null,epoch=0,fault=false;
 const storeFor=(id:string)=>{const store=owned.get(id);if(!store)throw Error('Unknown text model');return store;};
 async function operation<T>(work:(signal:AbortSignal,check:()=>void)=>Promise<T>){if(fault)throw Error('Stopped');if(busy)throw Error('Model busy');busy=true;const active=new AbortController(),own=epoch;controller=active;const check=()=>{active.signal.throwIfAborted();if(own!==epoch)throw Error('Stopped');};try{const result=await work(active.signal,check);check();return result;}finally{if(controller===active)controller=null;busy=false;}}
 function abort(){fault=true;epoch++;controller?.abort(Error('Stopped'));const old=client;client=null;return old?.abort();}
 async function disposeFailedClient(active:TextBackend){if(client!==active)return;client=null;try{await active.abort();}catch{fault=true;throw Object.assign(Error('Model cleanup not confirmed · reopen app'),{cleanupUnconfirmed:true});}}
 const status=(signal:AbortSignal)=>collectPreparedTextStatuses(owned,signal);
 return {get manifest(){return structuredClone(fixed);},get loaded(){return client?.loaded??null;},get failed(){return fault||!!client?.failed;},worker:{terminate:abort},abort,
  init(){return operation(signal=>status(signal));},
  call(cmd,args={},events){return operation(async(signal,check)=>{
   if(cmd==='status')return status(signal);
   if(cmd==='verify'){await storeFor(args.model).verify(signal);return true;}
   if(cmd==='prepare'){const store=storeFor(args.model);if(client?.loaded)throw Error('Unload model first');try{await store.prepare(args.allowNetwork===true,signal,(done,total)=>{check();events?.('progress','Verifying '+Math.round(done/total*100)+'%');},args.localFiles??[]);}finally{const old=client;if(old)await disposeFailedClient(old);}return true;}
   if(!['count','generate'].includes(cmd))throw Error('Unknown text operation');
   if(!client?.loaded)throw Error('Model not loaded');return client.call(cmd,args,events);
  });},
  load(id,events){return operation(async(_signal,check)=>{
   storeFor(id);if(client?.loaded)throw Error('Unload model first');if(client?.failed)client=null;let active=client;
   try{let importMs:number|undefined;if(!active){active=createClient();client=active;const importStarted=performance.now();await active.init();importMs=Math.max(0,performance.now()-importStarted);check();}const raw=await active.load(id,events);check();const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{};return {...(importMs!==undefined?{importMs}:{}),...(typeof source.verificationMs==='number'&&Number.isFinite(source.verificationMs)&&source.verificationMs>=0?{verificationMs:source.verificationMs}:{}),...(typeof source.runtimeLoadMs==='number'&&Number.isFinite(source.runtimeLoadMs)&&source.runtimeLoadMs>=0?{runtimeLoadMs:source.runtimeLoadMs}:{}),...(typeof source.totalLoadMs==='number'&&Number.isFinite(source.totalLoadMs)&&source.totalLoadMs>=0?{totalLoadMs:source.totalLoadMs}:{})};}
   catch(error){if(active)await disposeFailedClient(active);throw error;}
  });},
  unload(){return operation(async()=>{const active=client;if(!active)return;try{if(!active.failed)await active.unload();}catch(error){await disposeFailedClient(active);if(error instanceof Error){try{Object.assign(error,{cleanupConfirmed:true});}catch{/* An unmarked error keeps the lease. */}}throw error;}});},
 };
}
