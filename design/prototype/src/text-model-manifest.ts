import onnx from './onnx-text-manifest.json' with {type:'json'};
export const onnxTextManifest=onnx;
export const isOnnxText=(id:string)=>id===onnx.id;
export function combinedTextManifest(base:any,active=''){
 return {...base,contextTokens:isOnnxText(active)?onnx.contextTokens:base.contextTokens,runtime:isOnnxText(active)?onnx.runtime:base.runtime,models:[...base.models,{id:onnx.id,name:onnx.name,revision:onnx.revision,engine:onnx.engine,file:{bytes:onnx.files.reduce((n,f)=>n+f.bytes,0)}}]};
}

export function validateOnnxTextBudget(promptTokens:number,maxTokens:number){
 if(!Number.isSafeInteger(promptTokens)||promptTokens<0||!Number.isSafeInteger(maxTokens)||maxTokens<1||maxTokens>onnx.maxReplyTokens||promptTokens+maxTokens>onnx.contextTokens)throw Error('Text context budget exceeded');
}
