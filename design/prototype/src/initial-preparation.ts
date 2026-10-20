import {decisionManifest} from './decision-assets.ts';
import {capabilityState} from './local-capabilities.ts';
import {isOnnxText} from './text-model-manifest.ts';
import {combinedLocalTextManifest as combinedTextManifest,isLfmText} from './lfm-text-manifest.ts';
import type {Preferences} from './preference-records.ts';
import textManifest from '../../../dist/model-manifest.json' with {type:'json'};
// @ts-expect-error Shared strict manifest builder is JavaScript.
import {withLocalModels} from '../../../dist/local-model-manifest.js';
import {getSpeechManifest,speechModelLabel} from './speech-models.ts';
import {ocrFiles} from './ocr-assets.ts';
import {visionManifest} from './vision-assets.ts';
export type PreparationRole='text'|'speech'|'ocr'|'decision'|'vision';
type Role=PreparationRole;
export function textPreparationStatus(assets:Record<string,{filesPresent?:boolean;statusError?:boolean}|null>,model:string){
 // The owning worker returns an explicit null for a known model with no local
 // metadata yet. An absent key means its status was never checked.
 if(!Object.hasOwn(assets,model)||assets[model]===undefined)throw Error('Text file status unavailable · retry check in Models');
 const status=assets[model];
 return {text:status?.filesPresent===true,textStatusError:status?.statusError===true};
}
export function initialPreparationPlan(value:Preferences['models'],ready:Record<'text'|'speech'|'ocr',boolean>&{decision?:boolean;vision?:boolean;textStatusError?:boolean},onlyRole?:PreparationRole){
 const models=structuredClone(value),text=combinedTextManifest(withLocalModels(textManifest,value.customModels),'',value.customModels).models.find((m:{id:string})=>m.id===value.textModel);
 if(!text)throw Error('Choose a text model');
 if(ready.textStatusError&&(!onlyRole||onlyRole==='text'))throw Error('Text file status unavailable · retry check in Models');
 const selectedSpeech=value.customSpeechModels.find(model=>model.id===value.transcriptionModel);
 const builtinSpeech=getSpeechManifest(value.transcriptionModel);
 if((!onlyRole||onlyRole==='speech')&&value.transcriptionModel&&!builtinSpeech&&!selectedSpeech)throw Error('Speech runtime not connected');
 if((!onlyRole||onlyRole==='ocr')&&value.ocrModel&&value.ocrModel!=='tesseract-7')throw Error('Image text runtime not connected');
 if((!onlyRole||onlyRole==='decision')&&value.decisionModel&&capabilityState('decision.classify',value.decisionModel,false,value.customDecisionModels).status==='Runtime not connected')throw Error('Decision runtime not connected');
 if((!onlyRole||onlyRole==='vision')&&value.visionModel&&capabilityState('image.describe',value.visionModel,false).status==='Unsupported')throw Error('Vision runtime not connected');
 if(text.localModel&&!ready.text&&(!onlyRole||onlyRole==='text'))throw Error('Import local text model files first');
 // A reviewed model set may deliberately select text alone. Preparation must
 // never add readers or spend storage on roles that were left unselected.
 // Custom packages are imported locally and contribute no network bytes.
 const steps=[{role:'text' as Role,label:text.name,readyLabel:'Files present',ready:ready.text,bytes:text.file.bytes+((isOnnxText(text.id)||isLfmText(text.id,value.customModels))?0:textManifest.runtime.file.bytes)}];
 if(models.transcriptionModel)steps.push({role:'speech',label:selectedSpeech?.label??speechModelLabel(models.transcriptionModel),readyLabel:'Verified',ready:ready.speech,bytes:selectedSpeech?0:builtinSpeech?.files.reduce((n,f)=>n+f.bytes,0)??0});
 if(models.ocrModel)steps.push({role:'ocr',label:'Tesseract 7 · '+models.ocrLanguage,readyLabel:'Verified',ready:ready.ocr,bytes:ocrFiles(models.ocrLanguage).reduce((n,f)=>n+f.bytes,0)});
 if(models.decisionModel){const custom=models.customDecisionModels.find(m=>m.id===models.decisionModel);steps.push({role:'decision',label:custom?custom.label+' · text decisions':'Open d1 · text decisions',readyLabel:'Verified',ready:ready.decision===true,bytes:custom?0:decisionManifest.files.reduce((n,f)=>n+f.bytes,0)});}
 if(models.visionModel)steps.push({role:'vision',label:'LFM2.5-VL 450M · image understanding',readyLabel:'Verified',ready:ready.vision===true,bytes:visionManifest.files.reduce((n,f)=>n+f.bytes,0)});
 const selected=onlyRole?steps.filter(step=>step.role===onlyRole):steps;
 if(!selected.length)throw Error('Choose a '+onlyRole+' model');
 return {expected:JSON.stringify(value),models,steps:selected,bytes:selected.filter(s=>!s.ready).reduce((n,s)=>n+s.bytes,0)};
}
export type InitialPreparation=ReturnType<typeof initialPreparationPlan>;
export async function runInitialPreparation(plan:InitialPreparation,prepare:(role:Role)=>Promise<unknown>,commit:()=>Promise<unknown>,check=()=>{}){
 check();for(const step of plan.steps){if(step.ready&&step.role!=='text')continue;check();await prepare(step.role);check();}check();await commit();
}
