import source from './lfm3-manifest.json' with {type:'json'};
import q8Source from './lfm3-q8-manifest.json' with {type:'json'};
import runtimeAssets from '../runtime/wllama-lfm3/manifest.json' with {type:'json'};
import type {CustomLocalModel} from './preference-records.ts';

const pinned=(model:typeof source)=>({
 id:model.id,name:model.name,revision:model.revision,engine:model.engine,maxReplyTokens:model.maxReplyTokens,
 contextTokens:model.contextTokens,runtime:model.runtime,
 file:{name:model.file.name,bytes:model.file.bytes,sha256:model.file.sha256,url:model.file.url},
 repository:model.repository,license:model.license,
});
export const lfm3TextModels=[pinned(source),pinned(q8Source)];
export const lfm3RuntimeBytes=runtimeAssets.assets.reduce((total,asset)=>total+asset.bytes,0);
export const customLfm3TextModels=(custom:readonly CustomLocalModel[]=[])=>custom.filter(model=>model.engine==='wllama-lfm3').map(model=>({
 id:model.id,name:model.label,revision:model.revision,engine:'wllama-lfm3',contextTokens:model.contextTokens,maxReplyTokens:source.maxReplyTokens,runtime:source.runtime,
 file:{name:model.file.sha256+'.gguf',bytes:model.file.bytes,sha256:model.file.sha256},localModel:structuredClone(model),
}));
export const getLfm3TextManifest=(id:string,custom:readonly CustomLocalModel[]=[])=>[...lfm3TextModels,...customLfm3TextModels(custom)].find(model=>model.id===id);
export const isLfm3Text=(id:string,custom:readonly CustomLocalModel[]=[])=>!!getLfm3TextManifest(id,custom);
export const describeLfm3Text=(custom:readonly CustomLocalModel[]=[],activeId='',pinnedContextTokens=source.contextTokens)=>{
 if(![8192,16384,32768,65536,131072,262144].includes(pinnedContextTokens))throw Error('Unsupported LFM3 context window');
 const models=[...lfm3TextModels.map(model=>({...model,contextTokens:pinnedContextTokens})),...customLfm3TextModels(custom)],selected=models.find(model=>model.id===activeId);
 return {contextTokens:selected?.contextTokens??source.contextTokens,maxOutputTokens:selected?.maxReplyTokens??source.maxReplyTokens,runtime:source.runtime,models};
};
