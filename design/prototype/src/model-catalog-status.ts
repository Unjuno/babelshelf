import {capabilityState,type LocalCapability} from './local-capabilities.ts';
import type {CustomLocalModel} from './preference-records.ts';

export type ModelRole='text'|'decision'|'speech'|'ocr';
const roleCapability:Record<ModelRole,LocalCapability>={
 text:'text.generate',decision:'decision.classify',speech:'audio.transcribe',ocr:'image.ocr',
};

// Library entries are addable only when an installed app-owned adapter declares
// their role. A custom declaration is eligible only for a validated text adapter.
export function modelCatalogStatus(role:ModelRole,id:string,customModels:readonly CustomLocalModel[]=[]):string{
 if(role==='text'){
  const custom=customModels.find(model=>model.id===id);
  if(custom)return custom.engine==='webml-qwen35'||custom.engine==='wllama-lfm2'?'Not prepared':'Runtime not connected';
 }
 return capabilityState(roleCapability[role],id,false).status;
}
