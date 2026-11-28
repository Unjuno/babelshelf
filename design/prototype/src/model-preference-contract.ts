// @ts-expect-error Shared strict model declaration validator is JavaScript.
import {validateLocalModel} from '../../../dist/local-models.js';
import {OCR_LANGUAGES,type OcrLanguage} from './ocr-assets.ts';
import speechLanguages from './speech-languages.json' with {type:'json'};
import {settings} from './app-settings.ts';
import {validateCustomVisionModel} from './custom-vision-assets.ts';
import type {CustomDecisionModel,CustomLocalModel,CustomSpeechModel,CustomVisionModel,UserModelSet} from './model-registry-contract.ts';
import {semanticEmbeddingManifests} from './semantic-embedding-manifest.ts';

export function createModelPreferenceDefaults(schemaVersion:number){
 return {schemaVersion,customSets:[] as UserModelSet[],customModels:[] as CustomLocalModel[],customDecisionModels:[] as CustomDecisionModel[],customSpeechModels:[] as CustomSpeechModel[],customVisionModels:[] as CustomVisionModel[],visionModel:'',visionLibrary:[] as string[],ocrModel:'',ocrLibrary:[] as string[],ocrLanguage:'eng+jpn' as OcrLanguage,transcriptionLanguage:'en',textLibrary:[settings.defaults.textModel,'2B'] as string[],decisionLibrary:[] as string[],textModel:settings.defaults.textModel,lfm3ContextTokens:8192,decisionModel:settings.defaults.decisionModel,transcriptionModel:settings.defaults.transcriptionModel,transcriptionLibrary:settings.defaults.transcriptionModel?[settings.defaults.transcriptionModel]:[] as string[],searchModel:'',searchLibrary:[] as string[]};
}

export type ModelPreferences=ReturnType<typeof createModelPreferenceDefaults>;

export function validateModelPreferences(value:unknown):ModelPreferences{
 const m=value as ModelPreferences;
 if(![8192,16384,32768,65536,131072,262144].includes(m.lfm3ContextTokens)||!Array.isArray(m.customModels)||m.customModels.length>64||!Array.isArray(m.customDecisionModels)||m.customDecisionModels.length>32||!Array.isArray(m.customSpeechModels)||m.customSpeechModels.length>32||!Array.isArray(m.customVisionModels)||m.customVisionModels.length>32||!Array.isArray(m.customSets)||m.customSets.length>32||typeof m.searchModel!=='string'||!Array.isArray(m.searchLibrary)||new Set(m.searchLibrary).size!==m.searchLibrary.length||m.searchLibrary.some(id=>!semanticEmbeddingManifests.some(manifest=>manifest.id===id))||m.searchModel!==''&&!m.searchLibrary.includes(m.searchModel))throw Error('Unsupported custom model registry or LFM3 context window');
 m.customModels=m.customModels.map(validateLocalModel);m.customDecisionModels=m.customDecisionModels.map(validateLocalModel);m.customSpeechModels=m.customSpeechModels.map(validateLocalModel);m.customVisionModels=m.customVisionModels.map(validateCustomVisionModel);
 if(m.customModels.some(x=>x.role!=='text')||m.customDecisionModels.some(x=>x.role!=='decision')||m.customSpeechModels.some(x=>x.role!=='speech')||new Set([...m.customModels,...m.customDecisionModels,...m.customSpeechModels,...m.customVisionModels].map(x=>x.id)).size!==m.customModels.length+m.customDecisionModels.length+m.customSpeechModels.length+m.customVisionModels.length)throw Error('Duplicate or mismatched custom model');
 if(!Array.isArray(m.visionLibrary)||new Set(m.visionLibrary).size!==m.visionLibrary.length||m.visionLibrary.some(id=>id!==settings.models.vision[0].value&&!m.customVisionModels.some(model=>model.id===id))||m.visionModel!==''&&!m.visionLibrary.includes(m.visionModel))throw Error('Unsupported vision model');
 if(!Array.isArray(m.ocrLibrary)||new Set(m.ocrLibrary).size!==m.ocrLibrary.length||m.ocrLibrary.some(id=>id!=='tesseract-7')||m.ocrModel!==''&&!m.ocrLibrary.includes(m.ocrModel)||!OCR_LANGUAGES.includes(m.ocrLanguage))throw Error('Unsupported image reader');
 if(!speechLanguages.includes(m.transcriptionLanguage))throw Error('Unsupported transcription language');
 for(const [role,library,selected] of [['text',m.textLibrary,m.textModel],['decision',m.decisionLibrary,m.decisionModel]] as const){
  if(!Array.isArray(library)||new Set(library).size!==library.length||library.some(id=>!id||!settings.models[role].some(x=>x.value===id)&&!(role==='text'&&m.customModels.some(x=>x.id===id))&&!(role==='decision'&&m.customDecisionModels.some(x=>x.id===id))))throw Error('Unsupported model library');
  if(selected!==''&&!library.includes(selected))throw Error('Add the model before selecting it');
 }
 if(!Array.isArray(m.transcriptionLibrary)||new Set(m.transcriptionLibrary).size!==m.transcriptionLibrary.length||m.transcriptionLibrary.some(id=>!settings.models.transcription.some(x=>x.value===id)&&!m.customSpeechModels.some(x=>x.id===id)))throw Error('Unsupported transcription library');
 if(m.transcriptionModel!==''&&!m.transcriptionLibrary.includes(m.transcriptionModel))throw Error('Add the transcription model before selecting it');
 const modelSetIds=new Set<string>();
 for(const set of m.customSets){
  if(!set||typeof set!=='object'||Array.isArray(set)||Object.keys(set).sort().join('|')!=='detail|id|label|models'||typeof set.id!=='string'||!/^user-[a-z0-9]+(?:-[a-z0-9]+){0,5}$/.test(set.id)||set.id.length>48||modelSetIds.has(set.id)||typeof set.label!=='string'||!set.label.trim()||set.label.length>48||/[\u0000-\u001f\u007f]/.test(set.label)||typeof set.detail!=='string'||!set.detail.trim()||set.detail.length>120||/[\u0000-\u001f\u007f]/.test(set.detail))throw Error('Invalid custom model set');
  modelSetIds.add(set.id);
  const models=set.models;
  if(!models||typeof models!=='object'||Array.isArray(models)||Object.keys(models).sort().join('|')!=='decisionModel|ocrModel|searchModel|textModel|transcriptionModel|visionModel'||typeof models.textModel!=='string'||!m.textLibrary.includes(models.textModel)||typeof models.decisionModel!=='string'||models.decisionModel!==''&&!m.decisionLibrary.includes(models.decisionModel)||typeof models.transcriptionModel!=='string'||models.transcriptionModel!==''&&!m.transcriptionLibrary.includes(models.transcriptionModel)||typeof models.ocrModel!=='string'||models.ocrModel!==''&&!m.ocrLibrary.includes(models.ocrModel)||typeof models.visionModel!=='string'||models.visionModel!==''&&!m.visionLibrary.includes(models.visionModel)||typeof models.searchModel!=='string'||models.searchModel!==''&&!m.searchLibrary.includes(models.searchModel))throw Error('Custom model set references an unregistered model');
 }
 return m;
}
