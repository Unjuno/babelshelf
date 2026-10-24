import smol from './onnx-text-manifest.json' with {type:'json'};
import qwen from './qwen-text-manifest.json' with {type:'json'};
export const onnxTextManifest=smol;
const variant=smol.variants?.find(item=>item.id==='smollm2-360m-instruct-webgpu-q4f16');
if(!variant||variant.weight.url!==`https://huggingface.co/${smol.repository}/resolve/${smol.revision}/${variant.weight.path}`)throw Error('Invalid pinned ONNX model variant');
const smolWebGpu={...smol,id:variant.id,name:variant.name,engine:variant.engine,device:variant.device,dtype:variant.dtype,files:smol.files.map(file=>file.path==='onnx/model_quantized.onnx'?{...file,...variant.weight}:file)};
export const onnxTextModels=[smol,smolWebGpu,qwen];
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
