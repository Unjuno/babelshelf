import source from './lfm3-manifest.json' with {type:'json'};
import q8Source from './lfm3-q8-manifest.json' with {type:'json'};
import iq3mSource from './lfm3-iq3m-manifest.json' with {type:'json'};
import runtimeAssets from '../runtime/wllama-lfm3/manifest.json' with {type:'json'};
import type {CustomLocalModel} from './preference-records.ts';

const pinned=(model:typeof source)=>({
 id:model.id,name:model.name,revision:model.revision,engine:model.engine,maxReplyTokens:model.contextTokens,
 contextTokens:model.contextTokens,runtime:model.runtime,
 file:{name:model.file.name,bytes:model.file.bytes,sha256:model.file.sha256,url:model.file.url},
 repository:model.repository,license:model.license,
});
export const lfm3TextModels=[pinned(source),pinned(iq3mSource),pinned(q8Source)];
export const lfm3RuntimeBytes=runtimeAssets.assets.reduce((total,asset)=>total+asset.bytes,0);
const boundedTestContexts=[2048,4096,8192] as const;
export const customLfm3TextModels=(custom:readonly CustomLocalModel[]=[],testContextTokens?:number)=>custom.filter(model=>model.engine==='wllama-lfm3').map(model=>{
 const contextTokens=testContextTokens===undefined?model.contextTokens:Math.min(model.contextTokens,testContextTokens);
 return {id:model.id,name:model.label,revision:model.revision,engine:'wllama-lfm3',contextTokens,maxReplyTokens:contextTokens,runtime:source.runtime,
  file:{name:model.file.sha256+'.gguf',bytes:model.file.bytes,sha256:model.file.sha256},localModel:structuredClone(model)};
});
export const getLfm3TextManifest=(id:string,custom:readonly CustomLocalModel[]=[])=>[...lfm3TextModels,...customLfm3TextModels(custom)].find(model=>model.id===id);
export const isLfm3Text=(id:string,custom:readonly CustomLocalModel[]=[])=>!!getLfm3TextManifest(id,custom);
export const describeLfm3Text=(custom:readonly CustomLocalModel[]=[],activeId='',pinnedContextTokens=source.contextTokens,testContextTokens?:number)=>{
 if(![8192,16384,32768,65536,131072,262144].includes(pinnedContextTokens))throw Error('Unsupported LFM3 context window');
 if(testContextTokens!==undefined&&!boundedTestContexts.includes(testContextTokens as typeof boundedTestContexts[number]))throw Error('Unsupported LFM3 test context');
 const effectivePinnedContext=testContextTokens===undefined?pinnedContextTokens:Math.min(pinnedContextTokens,testContextTokens);
 const models=[...lfm3TextModels.map(model=>({...model,contextTokens:effectivePinnedContext,maxReplyTokens:effectivePinnedContext})),...customLfm3TextModels(custom,testContextTokens)],selected=models.find(model=>model.id===activeId);
 return {contextTokens:selected?.contextTokens??source.contextTokens,maxOutputTokens:selected?.maxReplyTokens??source.maxReplyTokens,runtime:source.runtime,models};
};
