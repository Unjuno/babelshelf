import {createPreparedTextBackend} from './prepared-text-backend.ts';
import {createPinnedAssetStore} from './pinned-text-assets.ts';
import {createOnnxTextClient} from './onnx-text-client.ts';
import {onnxTextModels} from './text-model-manifest.ts';
// Catalog/status/preparation must not import Transformers or create inference workers.
export function createOnnxTextBackend(createWorker:()=>Worker){
 const stores=new Map(onnxTextModels.map(manifest=>{
  const store=createPinnedAssetStore(manifest,{directory:async()=>await(await navigator.storage.getDirectory()).getDirectoryHandle('babelshelf-text-onnx-v1',{create:true}),fetch:globalThis.fetch.bind(globalThis)});
  return [manifest.id,{status:(signal:AbortSignal)=>store.status(signal),verify:async(signal:AbortSignal)=>{for(const file of manifest.files)await store.read(file.path,signal);},prepare:store.prepare}] as const;
 }));
 return createPreparedTextBackend({manifest:{models:onnxTextModels},stores,createClient:()=>createOnnxTextClient(createWorker())});
}
