import type {Preferences} from './preference-records.ts';
import textManifest from '../../../dist/model-manifest.json' with {type:'json'};
// @ts-expect-error Shared strict manifest builder is JavaScript.
import {withLocalModels} from '../../../dist/local-model-manifest.js';
import {speechManifest} from './speech-assets.ts';
import {ocrFiles} from './ocr-assets.ts';
type Role='text'|'speech'|'ocr';
export function initialPreparationPlan(value:Preferences['models'],ready:Record<Role,boolean>){
 const models=structuredClone(value),text=withLocalModels(textManifest,value.customModels).models.find((m:{id:string})=>m.id===value.textModel);
 if(!text)throw Error('Choose a text model');
 if(value.transcriptionModel&&value.transcriptionModel!=='whisper-tiny')throw Error('Speech runtime not connected');
 if(value.ocrModel&&value.ocrModel!=='tesseract-7')throw Error('Image text runtime not connected');
 if(text.localModel&&!ready.text)throw Error('Import local text model files first');
 models.transcriptionModel||='whisper-tiny';models.ocrModel||='tesseract-7';
 models.transcriptionLibrary=[...new Set([...models.transcriptionLibrary,models.transcriptionModel])];models.ocrLibrary=[...new Set([...models.ocrLibrary,models.ocrModel])];
 const steps=[{role:'text' as Role,label:text.name,ready:ready.text,bytes:text.file.bytes+textManifest.runtime.file.bytes},{role:'speech' as Role,label:'Whisper tiny',ready:ready.speech,bytes:speechManifest.files.reduce((n,f)=>n+f.bytes,0)},{role:'ocr' as Role,label:'Tesseract 7 · '+models.ocrLanguage,ready:ready.ocr,bytes:ocrFiles(models.ocrLanguage).reduce((n,f)=>n+f.bytes,0)}];
 return {expected:JSON.stringify(value),models,steps,bytes:steps.filter(s=>!s.ready).reduce((n,s)=>n+s.bytes,0)};
}
export type InitialPreparation=ReturnType<typeof initialPreparationPlan>;
export async function runInitialPreparation(plan:InitialPreparation,prepare:(role:Role)=>Promise<unknown>,commit:()=>Promise<unknown>,check=()=>{}){
 check();for(const step of plan.steps){if(step.ready)continue;check();await prepare(step.role);check();}check();await commit();
}
