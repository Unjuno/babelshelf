import {createPreparedTextBackend} from './prepared-text-backend.ts';
import {createPinnedAssetStore} from './pinned-text-assets.ts';
import {createIsolatedTextClient} from './isolated-text-client.ts';
import {lfmTextModels,describeLfmText} from './lfm-text-manifest.ts';
export function createLfmTextBackend(createWorker:()=>Worker){
 const stores=new Map(lfmTextModels.map(manifest=>{const store=createPinnedAssetStore(manifest,{directory:async()=>await(await navigator.storage.getDirectory()).getDirectoryHandle('babelshelf-text-lfm-v1',{create:true}),fetch:globalThis.fetch.bind(globalThis)});return [manifest.id,{status:(signal:AbortSignal)=>store.status(signal),verify:async(signal:AbortSignal)=>{await store.read(manifest.file.name,signal);},prepare:store.prepare}] as const;}));
 return createPreparedTextBackend({manifest:describeLfmText(),stores,createClient:()=>createIsolatedTextClient(createWorker(),{disposeHandshake:true})});
}
