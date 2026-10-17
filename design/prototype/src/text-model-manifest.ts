import smol from './onnx-text-manifest.json' with {type:'json'};
import qwen from './qwen-text-manifest.json' with {type:'json'};
export const onnxTextManifest=smol;
export const onnxTextModels=[smol,qwen];
export const getOnnxTextManifest=(id:string)=>onnxTextModels.find(m=>m.id===id);
export const isOnnxText=(id:string)=>!!getOnnxTextManifest(id);
export function combinedTextManifest(base:any,active=''){
 const selected=getOnnxTextManifest(active);
 return {...base,contextTokens:selected?.contextTokens??base.contextTokens,runtime:selected?.runtime??base.runtime,models:[...base.models,...onnxTextModels.map(m=>({id:m.id,name:m.name,revision:m.revision,engine:m.engine,file:{bytes:m.files.reduce((n,f)=>n+f.bytes,0)}}))]};
}
export function validateOnnxTextBudget(promptTokens:number,maxTokens:number,id=smol.id){
 const model=getOnnxTextManifest(id);if(!model)throw Error('Unknown text model');
 if(!Number.isSafeInteger(promptTokens)||promptTokens<0||!Number.isSafeInteger(maxTokens)||maxTokens<1||maxTokens>model.maxReplyTokens||promptTokens+maxTokens>model.contextTokens)throw Error('Text context budget exceeded');
}
