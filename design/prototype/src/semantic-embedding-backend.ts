import {createSemanticEmbeddingClient} from './semantic-embedding-client.ts';
import {semanticEmbeddingManifest} from './semantic-embedding-manifest.ts';
import {prepareProductRuntimeAssets,productRuntimeProgressLabel,verifyProductRuntimeAssets} from './product-runtime-assets.ts';

type Events=(type:string,value:unknown)=>void;

/**
 * Optional local embedding route. It owns no canonical Memory data; callers
 * provide their own revision-safe derived index and citation binding.
 */
export function createSemanticEmbeddingBackend(createWorker:()=>Worker=()=>new Worker(new URL('./semantic-embedding-worker.ts',import.meta.url),{type:'module',name:'BabelShelf local embeddings'})){
 let client:ReturnType<typeof createSemanticEmbeddingClient>|null=null,activeController:AbortController|null=null,closed=false;
 const getClient=()=>{if(closed)throw Error('Embedding backend closed');if(client?.failed)client=null;return client??=createSemanticEmbeddingClient(createWorker());};
 const run=<T>(work:(signal:AbortSignal,current:ReturnType<typeof createSemanticEmbeddingClient>)=>Promise<T>,signal?:AbortSignal,events?:Events)=>{
  if(closed)return Promise.reject(Error('Embedding backend closed'));
  if(activeController)return Promise.reject(Error('Embedding operation busy'));
  if(signal?.aborted)return Promise.reject(Error('Stopped'));
  const controller=new AbortController();activeController=controller;
  const onAbort=()=>{controller.abort();const old=client;client=null;if(old)old.abort();};
  signal?.addEventListener('abort',onAbort,{once:true});
  return Promise.resolve().then(()=>work(controller.signal,getClient())).then(value=>{controller.signal.throwIfAborted();return value;}).catch(error=>{if(controller.signal.aborted)throw Error('Stopped');throw error;}).finally(()=>{signal?.removeEventListener('abort',onAbort);if(activeController===controller)activeController=null;});
 };
 const progress=(events?:Events)=>(value:string)=>events?.('progress',value);
 return {
  manifest:structuredClone(semanticEmbeddingManifest),
  get loaded(){return client?.loaded??false;},
  prepareRuntime:(allowNetwork:boolean,signal?:AbortSignal,events?:Events)=>allowNetwork?prepareProductRuntimeAssets('search',{signal,onProgress:progress=>events?.('progress',productRuntimeProgressLabel(progress))}):verifyProductRuntimeAssets('search',{signal,onProgress:progress=>events?.('progress',productRuntimeProgressLabel(progress))}),
  verifyRuntime:(signal?:AbortSignal,events?:Events)=>verifyProductRuntimeAssets('search',{signal,onProgress:progress=>events?.('progress',productRuntimeProgressLabel(progress))}),
  status:(signal?:AbortSignal)=>run((_signal,current)=>current.status(),signal),
  verify:(signal?:AbortSignal,events?:Events)=>run((_signal,current)=>current.verify(),signal,events),
  prepare:(allowNetwork:boolean,localFiles:File[]=[],signal?:AbortSignal,events?:Events)=>run((_signal,current)=>current.prepare(allowNetwork,localFiles,progress(events)),signal,events),
  load:(signal?:AbortSignal,events?:Events)=>run(async(active,current)=>{await verifyProductRuntimeAssets('search',{signal:active,onProgress:item=>events?.('progress',productRuntimeProgressLabel(item))});active.throwIfAborted();await current.load(progress(events));return {model:semanticEmbeddingManifest.id,dimensions:semanticEmbeddingManifest.dimensions,device:semanticEmbeddingManifest.device};},signal,events),
  embed:(texts:readonly string[],signal?:AbortSignal,events?:Events)=>run((_signal,current)=>current.embed(texts),signal,events),
  unload:(signal?:AbortSignal)=>run(async(_signal,current)=>{await current.unload();return true;},signal),
  abort(){if(activeController){activeController.abort();activeController=null;}const old=client;client=null;if(old)old.abort();},
  close(){if(closed)return;this.abort();closed=true;},
 };
}
