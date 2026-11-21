/// <reference lib="webworker" />
import {lfm3TextModels} from './lfm3-text-manifest.ts';
import {createPinnedAssetStore} from './pinned-text-assets.ts';
import {writeOpfsRange} from './opfs-range-writer.ts';
import {serializeLfm3AssetFailure} from './lfm3-asset-worker-protocol.ts';

const controllers=new Map<number,AbortController>();
self.onmessage=async({data}:MessageEvent<any>)=>{
 if(data?.type==='cancel'){controllers.get(data.id)?.abort(Error('Stopped'));return;}
 const {id,model}=data??{};if(!Number.isSafeInteger(id)||id<1)return;
 const pinned=lfm3TextModels.find(item=>item.id===model);if(!pinned){self.postMessage({id,error:'Unknown pinned text model'});return;}
 if(controllers.has(id)){self.postMessage({id,error:'Model busy'});return;}
 const controller=new AbortController();controllers.set(id,controller);
 try{
  const store=createPinnedAssetStore({id:pinned.id,revision:pinned.revision,runtime:pinned.runtime,files:[{path:pinned.file.name,url:pinned.file.url,bytes:pinned.file.bytes,sha256:pinned.file.sha256}]},{
   directory:async()=>await(await navigator.storage.getDirectory()).getDirectoryHandle('babelshelf-text-lfm3-v1',{create:true}),
   fetch:globalThis.fetch.bind(globalThis),writeRange:writeOpfsRange,
  });
  const result=await store.prepare(data.allowNetwork===true,controller.signal,(done,total,phase)=>self.postMessage({id,progress:{done,total,phase}}));
  self.postMessage({id,value:result});
 }catch(error){self.postMessage(serializeLfm3AssetFailure(id,error));}
 finally{controllers.delete(id);}
};
