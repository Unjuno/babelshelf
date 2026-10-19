import {createPreparedTextBackend} from './prepared-text-backend.ts';
import {createPinnedAssetStore} from './pinned-text-assets.ts';
import {createIsolatedTextClient} from './isolated-text-client.ts';
import {lfmTextModels,describeLfmText} from './lfm-text-manifest.ts';
import {createLocalGgufAssetStore} from './local-gguf-asset-store.ts';
import type {CustomLocalModel} from './preference-records.ts';
export function createLfmTextBackend(createWorker:()=>Worker,customModels:CustomLocalModel[]=[]){
 const directory=async()=>await(await navigator.storage.getDirectory()).getDirectoryHandle('babelshelf-text-lfm-v1',{create:true});
 const stores=new Map(lfmTextModels.map(manifest=>{const store=createPinnedAssetStore(manifest,{directory:async()=>await(await navigator.storage.getDirectory()).getDirectoryHandle('babelshelf-text-lfm-v1',{create:true}),fetch:globalThis.fetch.bind(globalThis)});return [manifest.id,{status:(signal:AbortSignal)=>store.status(signal),verify:async(signal:AbortSignal)=>{await store.read(manifest.file.name,signal);},prepare:store.prepare}] as const;}));
 for(const model of customModels.filter(item=>item.engine==='wllama-lfm2')){const store=createLocalGgufAssetStore(model,{directory});stores.set(model.id,{status:store.status,verify:store.verify,prepare:(_allowNetwork,signal,progress,files)=>store.prepare(false,signal,progress,files)});}
 return createPreparedTextBackend({manifest:describeLfmText(customModels),stores,createClient:()=>createIsolatedTextClient(createWorker(),{disposeHandshake:true,initArgs:{customModels}})});
}
