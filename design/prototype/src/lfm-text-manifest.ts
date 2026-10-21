import {customQwen3Models,getQwen3TextManifest} from './qwen3-text-manifest.ts';
import {combinedTextManifest} from './text-model-manifest.ts';
import source from './lfm-manifest.json' with {type:'json'};
import runtime from '../runtime/wllama-count/manifest.json' with {type:'json'};
// Fixed app-owned candidates; no changes to defaults or arbitrary GGUF admission.
export const lfmRuntime=runtime;
const labels={'lfm25-350m-qad-q4-0':'LFM2.5 · 350M · QAD','lfm25-230m-qad-q4-0':'LFM2.5 · 230M · QAD'};
export const lfmTextModels=source.models.filter(m=>m.id in labels).map(m=>({...m,name:labels[m.id as keyof typeof labels],engine:'wllama-cpu-count',contextTokens:2048,runtime,files:[{...m.file,path:m.file.name}]}));
export function customLfmTextModels(custom:readonly any[]=[]){return custom.filter(m=>m?.engine==='wllama-lfm2').map(m=>({id:m.id,name:m.label,revision:m.revision,engine:'wllama-cpu-count',contextTokens:2048,runtime,file:{name:m.file.sha256+'.gguf',bytes:m.file.bytes,sha256:m.file.sha256},localModel:structuredClone(m)}));}
export const getLfmTextManifest=(id:string,custom:readonly any[]=[])=>([...lfmTextModels,...customLfmTextModels(custom)]).find(m=>m.id===id);
export const isLfmText=(id:string,custom:readonly any[]=[])=>(!!getLfmTextManifest(id,custom));
export const describeLfmText=(custom:readonly any[]=[])=>( {contextTokens:2048,runtime,models:[...lfmTextModels,...customLfmTextModels(custom)]});

export function combinedLocalTextManifest(base:any,active='',custom:readonly any[]=[]){const models=[...customLfmTextModels(custom),...customQwen3Models(custom)],combined=combinedTextManifest(base,active),selected=getLfmTextManifest(active,custom)??getQwen3TextManifest(active,custom);return {...combined,...(selected?{contextTokens:2048,runtime}:{}),models:[...combined.models,...lfmTextModels,...models]};}
