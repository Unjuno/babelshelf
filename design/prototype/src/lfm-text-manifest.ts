import {combinedTextManifest} from './text-model-manifest.ts';
import source from './lfm-manifest.json' with {type:'json'};
import runtime from '../runtime/wllama-count/manifest.json' with {type:'json'};
// Fixed app-owned candidate; no changes to defaults or arbitrary GGUF admission.
export const lfmRuntime=runtime;
export const lfmTextModels=source.models.filter(m=>m.id==='lfm25-350m-qad-q4-0').map(m=>({...m,name:'LFM2.5 · 350M · QAD',engine:'wllama-cpu-count',contextTokens:2048,runtime,files:[{...m.file,path:m.file.name}]}));
export const getLfmTextManifest=(id:string)=>lfmTextModels.find(m=>m.id===id);
export const isLfmText=(id:string)=>!!getLfmTextManifest(id);
export const describeLfmText=()=>({contextTokens:2048,runtime,models:lfmTextModels});

export function combinedLocalTextManifest(base:any,active=''){const combined=combinedTextManifest(base,active),selected=getLfmTextManifest(active);return {...combined,...(selected?{contextTokens:2048,runtime}:{}),models:[...combined.models,...lfmTextModels]};}
