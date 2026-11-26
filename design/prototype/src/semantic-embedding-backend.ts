import {createSemanticEmbeddingClient} from './semantic-embedding-client.ts';
import {semanticEmbeddingManifest,semanticEmbeddingManifestFor} from './semantic-embedding-manifest.ts';
import {prepareProductRuntimeAssets,productRuntimeProgressLabel,verifyProductRuntimeAssets} from './product-runtime-assets.ts';

type Events=(type:string,value:unknown)=>void;

/**
 * Optional local embedding route. It owns no canonical Memory data; callers
 * provide their own revision-safe derived index and citation binding.
 */
export function createSemanticEmbeddingBackend(modelIdOrWorker:string|(()=>Worker)=semanticEmbeddingManifest.id,workerOverride?:()=>Worker){
 const modelId=typeof modelIdOrWorker==='string'?modelIdOrWorker:semanticEmbeddingManifest.id;
 const createWorker=typeof modelIdOrWorker==='function'?modelIdOrWorker:workerOverride;
 const manifest=semanticEmbeddingManifestFor(modelId);
 // Keep the Vite-only worker constructors out of Node tests that inject a
 // fake Worker. The browser factory still compiles both workers as JS bundles.
 let client:ReturnType<typeof createSemanticEmbeddingClient>|null=null,activeController:AbortController|null=null,closed=false;
 let tail:Promise<void>=Promise.resolve();const controllers=new Set<AbortController>();
 const getClient=async(signal:AbortSignal)=>{
  if(closed)throw Error('Embedding backend closed');if(client?.failed)client=null;if(client)return client;
  const worker=createWorker?createWorker():(await import('./semantic-embedding-worker-factory.ts')).createSemanticEmbeddingWorker(manifest.id);
  if(closed||signal.aborted){worker.terminate();if(closed)throw Error('Embedding backend closed');throw Error('Stopped');}
  return client??=createSemanticEmbeddingClient(worker);
 };
 const run=<T>(work:(signal:AbortSignal,current:ReturnType<typeof createSemanticEmbeddingClient>)=>Promise<T>,signal?:AbortSignal,events?:Events)=>{
  if(closed)return Promise.reject(Error('Embedding backend closed'));
  if(signal?.aborted)return Promise.reject(Error('Stopped'));
  const controller=new AbortController();controllers.add(controller);
  const onAbort=()=>controller.abort();signal?.addEventListener('abort',onAbort,{once:true});
  const stopped=new Promise<never>((_resolve,reject)=>controller.signal.addEventListener('abort',()=>{
   if(activeController===controller){const old=client;client=null;if(old)old.abort();}
   reject(Error('Stopped'));
  },{once:true}));
  const queued=tail.then(async()=>{
   controller.signal.throwIfAborted();if(closed)throw Error('Embedding backend closed');
   activeController=controller;
   try{const current=await getClient(controller.signal),value=await work(controller.signal,current);controller.signal.throwIfAborted();return value;}
   catch(error){if(controller.signal.aborted)throw Error('Stopped');throw error;}
   finally{if(activeController===controller)activeController=null;}
  });
  tail=queued.then(()=>{},()=>{});
  return Promise.race([queued,stopped]).finally(()=>{signal?.removeEventListener('abort',onAbort);controllers.delete(controller);});
 };
 const progress=(events?:Events)=>(value:string)=>events?.('progress',value);
 return {
  manifest:structuredClone(manifest),
  get loaded(){return client?.loaded??false;},
  prepareRuntime:(allowNetwork:boolean,signal?:AbortSignal,events?:Events)=>allowNetwork?prepareProductRuntimeAssets('search',{signal,onProgress:progress=>events?.('progress',productRuntimeProgressLabel(progress))}):verifyProductRuntimeAssets('search',{signal,onProgress:progress=>events?.('progress',productRuntimeProgressLabel(progress))}),
  verifyRuntime:(signal?:AbortSignal,events?:Events)=>verifyProductRuntimeAssets('search',{signal,onProgress:progress=>events?.('progress',productRuntimeProgressLabel(progress))}),
  status:(signal?:AbortSignal)=>run((_signal,current)=>current.status(),signal),
  verify:(signal?:AbortSignal,events?:Events)=>run((_signal,current)=>current.verify(),signal,events),
  prepare:(allowNetwork:boolean,localFiles:File[]=[],signal?:AbortSignal,events?:Events)=>run((_signal,current)=>current.prepare(allowNetwork,localFiles,progress(events)),signal,events),
  load:(signal?:AbortSignal,events?:Events)=>run(async(active,current)=>{await verifyProductRuntimeAssets('search',{signal:active,onProgress:item=>events?.('progress',productRuntimeProgressLabel(item))});active.throwIfAborted();await current.load(progress(events));return {model:manifest.id,dimensions:manifest.dimensions,device:manifest.device};},signal,events),
  embed:(texts:readonly string[],signal?:AbortSignal,events?:Events)=>run((_signal,current)=>current.embed(texts),signal,events),
  unload:(signal?:AbortSignal)=>run(async(_signal,current)=>{await current.unload();return true;},signal),
  abort(){for(const controller of controllers)controller.abort();const old=client;client=null;if(old)old.abort();},
  close(){if(closed)return;this.abort();closed=true;},
 };
}
