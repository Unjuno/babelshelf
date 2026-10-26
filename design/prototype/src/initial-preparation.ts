import {getQwen3TextManifest} from './qwen3-text-manifest.ts';
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
export function preparationRoles(value:Preferences['models'],onlyRole?:PreparationRole):PreparationRole[]{
 const selections=[['text','textModel'],['speech','transcriptionModel'],['ocr','ocrModel'],['decision','decisionModel'],['vision','visionModel']] as const;
 return selections.filter(([role,key])=>(!onlyRole||role===onlyRole)&&!!value[key]).map(([role])=>role);
}
export function textPreparationStatus(assets:Record<string,{filesPresent?:boolean;statusError?:boolean}|null>,model:string){
 // The owning worker returns an explicit null for a known model with no local
 // metadata yet. An absent key means its status was never checked.
 if(!Object.hasOwn(assets,model)||assets[model]===undefined)throw Error('Text file status unavailable · retry check in Models');
 const status=assets[model];
 return {text:status?.filesPresent===true,textStatusError:status?.statusError===true};
}
export function initialPreparationPlan(value:Preferences['models'],ready:Record<'text'|'speech'|'ocr',boolean>&{decision?:boolean;vision?:boolean;textStatusError?:boolean},onlyRole?:PreparationRole){
 const models=structuredClone(value),roles=preparationRoles(value,onlyRole),text=roles.includes('text')?combinedTextManifest(withLocalModels(textManifest,value.customModels),'',value.customModels).models.find((m:{id:string})=>m.id===value.textModel):undefined;
 if(roles.includes('text')&&!text)throw Error('Text runtime not connected');
 if(text&&ready.textStatusError)throw Error('Text file status unavailable · retry check in Models');
 const selectedSpeech=value.customSpeechModels.find(model=>model.id===value.transcriptionModel);
 const builtinSpeech=getSpeechManifest(value.transcriptionModel);
 if(roles.includes('speech')&&value.transcriptionModel&&!builtinSpeech&&!selectedSpeech)throw Error('Speech runtime not connected');
 if(roles.includes('ocr')&&value.ocrModel&&value.ocrModel!=='tesseract-7')throw Error('Image text runtime not connected');
 if(roles.includes('decision')&&value.decisionModel&&capabilityState('decision.classify',value.decisionModel,false,value.customDecisionModels).status==='Runtime not connected')throw Error('Decision runtime not connected');
 const selectedVision=value.customVisionModels.find(model=>model.id===value.visionModel);
 if(roles.includes('vision')&&value.visionModel&&capabilityState('image.describe',value.visionModel,false,[],[],value.customVisionModels).status==='Unsupported')throw Error('Vision runtime not connected');
 if(roles.includes('vision')&&selectedVision&&!ready.vision)throw Error('Import local Vision files first');
 if(text?.localModel&&!ready.text)throw Error('Import local text model files first');
 // A reviewed model set may deliberately select text alone. Preparation must
 // never add readers or spend storage on roles that were left unselected.
 // Custom packages are imported locally and contribute no network bytes.
 const steps:{role:Role;label:string;readyLabel:string;ready:boolean;bytes:number}[]=[];
 if(text)steps.push({role:'text',label:text.name,readyLabel:'Files present',ready:ready.text,bytes:text.file.bytes+((isOnnxText(text.id)||isLfmText(text.id,value.customModels)||getQwen3TextManifest(text.id,value.customModels))?0:textManifest.runtime.file.bytes)});
 if(roles.includes('speech'))steps.push({role:'speech',label:selectedSpeech?.label??speechModelLabel(models.transcriptionModel),readyLabel:'Files verified',ready:ready.speech,bytes:selectedSpeech?0:builtinSpeech?.files.reduce((n,f)=>n+f.bytes,0)??0});
 if(roles.includes('ocr'))steps.push({role:'ocr',label:'Tesseract 7 · '+models.ocrLanguage,readyLabel:'Files verified',ready:ready.ocr,bytes:ocrFiles(models.ocrLanguage).reduce((n,f)=>n+f.bytes,0)});
 if(roles.includes('decision')){const custom=models.customDecisionModels.find(m=>m.id===models.decisionModel);steps.push({role:'decision',label:custom?custom.label+' · text decisions':'Open d1 · text decisions',readyLabel:'Files verified',ready:ready.decision===true,bytes:custom?0:decisionManifest.files.reduce((n,f)=>n+f.bytes,0)});}
 if(roles.includes('vision'))steps.push({role:'vision',label:selectedVision?.label??'LFM2.5-VL 450M · image understanding',readyLabel:'Files verified',ready:ready.vision===true,bytes:selectedVision?0:visionManifest.files.reduce((n,f)=>n+f.bytes,0)});
 const selected=steps;
 if(!selected.length)throw Error(onlyRole?'Choose a '+onlyRole+' model':'Choose a model');
 return {expected:JSON.stringify(value),models,steps:selected,bytes:selected.filter(s=>!s.ready).reduce((n,s)=>n+s.bytes,0)};
}
export type InitialPreparation=ReturnType<typeof initialPreparationPlan>;
type PreparationStep=InitialPreparation['steps'][number];
export function assertPreparationSettings(plan:InitialPreparation,current:{models:Preferences['models'];connection:Pick<Preferences['connection'],'downloads'>},step?:PreparationStep){
 if(JSON.stringify(current.models)!==plan.expected)throw Error('Model settings changed · review again');
 if(step&&!step.ready&&step.bytes>0&&!current.connection.downloads)throw Error('Downloads are off');
}
export async function runInitialPreparation(plan:InitialPreparation,prepare:(role:Role)=>Promise<unknown>,commit:()=>Promise<unknown>,check=()=>{},review:(step?:PreparationStep)=>Promise<void>=async()=>{}){
 const reviewed=async(step?:PreparationStep)=>{check();await review(step);check();};
 check();for(const step of plan.steps){await reviewed(step);await prepare(step.role);check();}await reviewed();await commit();
}
