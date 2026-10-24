import {capabilityState,type LocalCapability} from './local-capabilities.ts';
import type {CustomDecisionModel,CustomLocalModel,CustomSpeechModel,CustomVisionModel} from './preference-records.ts';
import {textAssetInput} from './asset-activity.ts';
import {textExecutionRoute} from './text-execution-route.ts';

export type ModelRole='text'|'decision'|'speech'|'ocr'|'vision';
const roleCapability:Record<ModelRole,LocalCapability>={
 text:'text.generate',decision:'decision.classify',speech:'audio.transcribe',ocr:'image.ocr',vision:'image.describe',
};

// A custom declaration becomes selectable only for an app-owned adapter that
// validates the role-specific package and routes it through local inference.
export function modelCatalogStatus(role:ModelRole,id:string,customModels:readonly CustomLocalModel[]=[],customDecisionModels:readonly CustomDecisionModel[]=[],customSpeechModels:readonly CustomSpeechModel[]=[],customVisionModels:readonly CustomVisionModel[]=[]):string{
 if(role==='vision'&&id!=='lfm25-vl-450m-q4f16')return customVisionModels.some(model=>model.id===id&&model.engine==='transformers-lfm2-vl-onnx')?'Not prepared':'Runtime not connected';
 if(role==='text'){
  const custom=customModels.find(model=>model.id===id);
  if(custom)return custom.engine==='webml-qwen35'||['wllama-lfm2','wllama-qwen3'].includes(custom.engine)?'Not prepared':'Runtime not connected';
 }
 if(role==='decision'){
  const custom=customDecisionModels.find(model=>model.id===id);
  if(custom)return custom.engine==='onnx-d1-text'?'Not prepared':'Runtime not connected';
 }
 if(role==='speech'){
  const custom=customSpeechModels.find(model=>model.id===id);
  if(custom)return custom.engine==='transformers-whisper-onnx'?'Not prepared':'Runtime not connected';
 }
 return capabilityState(roleCapability[role],id,false).status;
}

export function canAddModel(role:ModelRole,id:string,customModels:readonly CustomLocalModel[]=[],customDecisionModels:readonly CustomDecisionModel[]=[],customSpeechModels:readonly CustomSpeechModel[]=[],customVisionModels:readonly CustomVisionModel[]=[]):boolean{
 return modelCatalogStatus(role,id,customModels,customDecisionModels,customSpeechModels,customVisionModels)==='Not prepared';
}

// The pinned weight/package size is useful before selection. It is not a RAM
// estimate, a free-space check, or proof that this device can run the model.
export function textModelFileSize(id:string,customModels:readonly CustomLocalModel[]=[]):number|null{
 const custom=customModels.find(model=>model.id===id);
 if(custom&&Number.isSafeInteger(custom.file?.bytes)&&custom.file.bytes>0)return custom.file.bytes;
 try{
  const model=textAssetInput(id,false,undefined,[...customModels]).model;
  if('files' in model&&Array.isArray(model.files))return model.files.reduce((total,file)=>total+file.bytes,0);
  if('file' in model&&model.file)return model.file.bytes;
  return null;
 }catch{return null;}
}
export function textModelChoiceHint(id:string,customModels:readonly CustomLocalModel[]=[]):string{
 const bytes=textModelFileSize(id,customModels);
 if(bytes===null)return 'Size unavailable';
 const size=bytes>=1e9?(bytes/1e9).toFixed(2)+' GB':Math.round(bytes/1e6)+' MB';
 const custom=customModels.find(model=>model.id===id);
 if(custom){
  const route=textExecutionRoute(id,customModels),execution=route?.backend==='webgpu'?'WebGPU path':route?.backend==='cpu-wasm'?'CPU WASM path':'runtime unavailable';
  return size+' · '+execution+' · execution not tested';
 }
 return id==='9B'?size+' · PC prose unstable':size+' · model files';
}
