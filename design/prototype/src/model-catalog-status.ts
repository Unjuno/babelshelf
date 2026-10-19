import {capabilityState,type LocalCapability} from './local-capabilities.ts';
import type {CustomDecisionModel,CustomLocalModel,CustomSpeechModel} from './preference-records.ts';

export type ModelRole='text'|'decision'|'speech'|'ocr';
const roleCapability:Record<ModelRole,LocalCapability>={
 text:'text.generate',decision:'decision.classify',speech:'audio.transcribe',ocr:'image.ocr',
};

// A custom declaration becomes selectable only for an app-owned adapter that
// validates the role-specific package and routes it through local inference.
export function modelCatalogStatus(role:ModelRole,id:string,customModels:readonly CustomLocalModel[]=[],customDecisionModels:readonly CustomDecisionModel[]=[],customSpeechModels:readonly CustomSpeechModel[]=[]):string{
 if(role==='text'){
  const custom=customModels.find(model=>model.id===id);
  if(custom)return custom.engine==='webml-qwen35'||custom.engine==='wllama-lfm2'?'Not prepared':'Runtime not connected';
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
