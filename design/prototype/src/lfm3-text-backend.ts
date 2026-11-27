import {createPreparedTextBackend} from './prepared-text-backend.ts';
import {createPinnedAssetStore} from './pinned-text-assets.ts';
import {createLocalGgufAssetStore} from './local-gguf-asset-store.ts';
import {createIsolatedTextClient,DEFAULT_TEXT_MODEL_LOAD_TIMEOUT_MS} from './isolated-text-client.ts';
import {customLfm3TextModels,describeLfm3Text,lfm3TextModels} from './lfm3-text-manifest.ts';
import type {CustomLocalModel} from './preference-records.ts';
import {deserializeLfm3AssetFailure} from './lfm3-asset-worker-protocol.ts';

/** LFM3's pinned Wllama load reports its start and GPU-offload log, but no
 * heartbeat while WebGPU tensors are being transferred. On iPhone Safari this
 * stage can legitimately exceed the generic five-minute idle window. Keep the
 * ten-minute hard ceiling, but let LFM3 use that same bounded window before
 * treating silence as a stalled worker. */
export function createLfm3TextClient(worker:Worker,initArgs:any={}){
 return createIsolatedTextClient(worker,{disposeHandshake:true,initArgs,loadIdleTimeoutMs:DEFAULT_TEXT_MODEL_LOAD_TIMEOUT_MS});
}

export function preparePinnedInWorker(model:string,signal:AbortSignal,progress:(done:number,total:number,phase?:'downloading'|'verifying')=>void,createAssetWorker:()=>Worker=()=>new Worker(new URL('./lfm3-assets-worker.ts',import.meta.url),{type:'module',name:'BabelShelf LFM3 asset preparation'})){
 const worker=createAssetWorker(),id=1;
 return new Promise((resolve,reject)=>{
  let settled=false;
  const cleanup=()=>{signal.removeEventListener('abort',abort);worker.terminate();};
  const finish=(error?:Error,value?:unknown)=>{if(settled)return;settled=true;cleanup();if(error)reject(error);else resolve(value);};
  const abort=()=>worker.postMessage({type:'cancel',id});
  signal.addEventListener('abort',abort,{once:true});
  worker.onerror=event=>finish(new Error(event.message||'Model asset worker failed'));
  worker.onmessage=({data})=>{if(data?.id!==id)return;if(data.progress&&Number.isFinite(data.progress.done)&&Number.isFinite(data.progress.total))progress(data.progress.done,data.progress.total,data.progress.phase);else if(typeof data.error==='string')finish(deserializeLfm3AssetFailure(data));else if('value'in data)finish(undefined,data.value);};
  if(signal.aborted){abort();finish(Error('Stopped'));return;}
  worker.postMessage({id,model,allowNetwork:true});
 });
}

export function createLfm3TextBackend(createWorker:()=>Worker,custom:CustomLocalModel[]=[],pinnedContextTokens=8192,testContextTokens?:number) {
 const directory=async()=>await(await navigator.storage.getDirectory()).getDirectoryHandle('babelshelf-text-lfm3-v1',{create:true});
 const stores=new Map<string,any>();
 for(const pinned of lfm3TextModels){
  const pinnedStore=createPinnedAssetStore({id:pinned.id,revision:pinned.revision,runtime:pinned.runtime,files:[{path:pinned.file.name,url:pinned.file.url,bytes:pinned.file.bytes,sha256:pinned.file.sha256}]},{directory,fetch:globalThis.fetch.bind(globalThis)});
  stores.set(pinned.id,{status:pinnedStore.status,verify:async(signal:AbortSignal)=>{await pinnedStore.read(pinned.file.name,signal);},prepare:(allowNetwork:boolean,signal:AbortSignal,progress:any,files:File[])=>allowNetwork&&!files.length?preparePinnedInWorker(pinned.id,signal,progress):pinnedStore.prepare(allowNetwork,signal,progress,files),discardIncomplete:pinnedStore.discardIncomplete});
 }
 for(const model of customLfm3TextModels(custom)){
  if(!('localModel'in model))continue;
  const store=createLocalGgufAssetStore(model,{directory});
  stores.set(model.id,{status:store.status,verify:store.verify,prepare:(_allowNetwork:boolean,signal:AbortSignal,progress:(n:number,total:number)=>void,files:File[])=>store.prepare(false,signal,progress,files)});
 }
 return createPreparedTextBackend({manifest:describeLfm3Text(custom,'',pinnedContextTokens,testContextTokens),stores,createClient:()=>createLfm3TextClient(createWorker(),{customModels:custom,pinnedContextTokens,...(testContextTokens===undefined?{}:{testContextTokens})})});
}
