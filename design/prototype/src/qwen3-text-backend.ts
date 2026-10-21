import {createPreparedTextBackend} from './prepared-text-backend.ts';
import {createIsolatedTextClient} from './isolated-text-client.ts';
import {createLocalGgufAssetStore} from './local-gguf-asset-store.ts';
import {describeQwen3Text} from './qwen3-text-manifest.ts';
import type {CustomLocalModel} from './preference-records.ts';
export function createQwen3TextBackend(createWorker:()=>Worker,custom:CustomLocalModel[]=[]){
 const models=custom.filter(m=>m.engine==='wllama-qwen3'),directory=async()=>await(await navigator.storage.getDirectory()).getDirectoryHandle('babelshelf-text-qwen3-v1',{create:true});
 const stores=new Map(models.map(model=>{const store=createLocalGgufAssetStore(model,{directory});return [model.id,{status:store.status,verify:store.verify,prepare:(_allowNetwork:boolean,signal:AbortSignal,progress:(n:number,total:number)=>void,files:File[])=>store.prepare(false,signal,progress,files)}] as const;}));
 return createPreparedTextBackend({manifest:describeQwen3Text(models),stores,createClient:()=>createIsolatedTextClient(createWorker(),{disposeHandshake:true,initArgs:{customModels:models}})});
}
