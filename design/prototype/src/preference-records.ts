// @ts-expect-error Shared strict model declaration validator is JavaScript.
import {validateLocalModel} from '../../../dist/local-models.js';
import {OCR_LANGUAGES,type OcrLanguage} from './ocr-assets.ts';
import speechLanguages from './speech-languages.json' with {type:'json'};
import {settings} from './app-settings.ts';

export type CustomLocalModel={id:string;label:string;role:'text';engine:'webml-qwen35'|'wllama-lfm2';revision:string;file:{bytes:number;sha256:string};source?:{provider:'huggingface';repo:string;revision:string;file:string;license:string|null};inspection:{format:'GGUF';version:number;bytes:number;name:string;architecture:string;contextLength:number;tokenizer:string;chatTemplate:boolean;tokenCount:number;tensorCount:number;tensorTypes:number[];tensorExtentsChecked:boolean}};
export type CustomDecisionModel={id:string;label:string;role:'decision';engine:'onnx-d1-text';revision:string;files:{path:string;bytes:number;sha256:string}[];inspection:{format:'D1-ONNX';architecture:'d1_omni';contextTokens:16384;inputLimit:2048;scope:'text-only'}};
export type CustomSpeechModel={id:string;label:string;role:'speech';engine:'transformers-whisper-onnx';revision:string;files:{path:string;bytes:number;sha256:string}[];inspection:{format:'Whisper-ONNX';architecture:'whisper';device:'wasm';dtype:'q8';maxDurationSeconds:120}};
export type PreferenceGroup='models'|'appearance'|'connection';
const defaults={
 models:{customModels:[] as CustomLocalModel[],customDecisionModels:[] as CustomDecisionModel[],customSpeechModels:[] as CustomSpeechModel[],ocrModel:'',ocrLibrary:[] as string[],ocrLanguage:'eng+jpn' as OcrLanguage,transcriptionLanguage:'en',textLibrary:[settings.defaults.textModel] as string[],decisionLibrary:[] as string[],textModel:settings.defaults.textModel,decisionModel:settings.defaults.decisionModel,transcriptionModel:settings.defaults.transcriptionModel,transcriptionLibrary:settings.defaults.transcriptionModel?[settings.defaults.transcriptionModel]:[] as string[]},
 appearance:{theme:settings.defaults.theme,background:settings.defaults.background,glass:settings.defaults.glass},
 connection:{downloads:settings.defaults.downloads},
};
export type Preferences=typeof defaults;
export type PreferenceRecord={id:string;path:string;body:string;version:number;history:string[];paths?:string[];managed?:boolean;protected?:boolean};
export const preferencePath=(group:PreferenceGroup)=>'Settings/'+group+'.md';
export function formatPreference<G extends PreferenceGroup>(group:G,value:Preferences[G]){return '# '+group[0].toUpperCase()+group.slice(1)+'\n\n```json\n'+JSON.stringify(value,null,2)+'\n```\n';}

export function parsePreference<G extends PreferenceGroup>(group:G,body:string):Preferences[G]{
 const block=body.match(/^# [^\n]+\n\n```json\n([\s\S]+)\n```\n?$/);
 if(!block)throw Error('Use one JSON block below the heading');
 const value=JSON.parse(block[1]);
 // Older model records remain readable; original bytes stay in revision history.
 if(group==='models'&&value&&typeof value==='object'&&!Array.isArray(value)&&!('textLibrary' in value)&&!('decisionLibrary' in value)){
  value.textLibrary=value.textModel?[value.textModel]:[];value.decisionLibrary=value.decisionModel?[value.decisionModel]:[];
 }
 if(group==='models'&&value&&typeof value==='object'&&!Array.isArray(value)&&!('transcriptionLanguage' in value))value.transcriptionLanguage='en';
 if(group==='models'&&value&&typeof value==='object'&&!Array.isArray(value)&&!('ocrModel' in value)&&!('ocrLibrary' in value)&&!('ocrLanguage' in value)){value.ocrModel='';value.ocrLibrary=[];value.ocrLanguage='eng+jpn';}
 if(group==='models'&&value&&typeof value==='object'&&!Array.isArray(value)&&!('customModels' in value))value.customModels=[];
 if(group==='models'&&value&&typeof value==='object'&&!Array.isArray(value)&&!('customDecisionModels' in value))value.customDecisionModels=[];
 if(group==='models'&&value&&typeof value==='object'&&!Array.isArray(value)&&!('customSpeechModels' in value))value.customSpeechModels=[];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==Object.keys(defaults[group]).sort().join('|'))throw Error('Unknown or missing setting');
 if(group==='models'){
  const m=value as Preferences['models'];if(!Array.isArray(m.customModels)||m.customModels.length>64||!Array.isArray(m.customDecisionModels)||m.customDecisionModels.length>32||!Array.isArray(m.customSpeechModels)||m.customSpeechModels.length>32)throw Error('Unsupported custom model registry');m.customModels=m.customModels.map(validateLocalModel);m.customDecisionModels=m.customDecisionModels.map(validateLocalModel);m.customSpeechModels=m.customSpeechModels.map(validateLocalModel);if(m.customModels.some(x=>x.role!=='text')||m.customDecisionModels.some(x=>x.role!=='decision')||m.customSpeechModels.some(x=>x.role!=='speech')||new Set([...m.customModels,...m.customDecisionModels,...m.customSpeechModels].map(x=>x.id)).size!==m.customModels.length+m.customDecisionModels.length+m.customSpeechModels.length)throw Error('Duplicate or mismatched custom model');if(!Array.isArray(m.ocrLibrary)||new Set(m.ocrLibrary).size!==m.ocrLibrary.length||m.ocrLibrary.some(id=>id!=='tesseract-7')||m.ocrModel!==''&&!m.ocrLibrary.includes(m.ocrModel)||!OCR_LANGUAGES.includes(m.ocrLanguage))throw Error('Unsupported image reader');if(!speechLanguages.includes(m.transcriptionLanguage))throw Error('Unsupported transcription language');
  for(const [role,library,selected] of [['text',m.textLibrary,m.textModel],['decision',m.decisionLibrary,m.decisionModel]] as const){
   if(!Array.isArray(library)||new Set(library).size!==library.length||library.some(id=>!id||!settings.models[role].some(x=>x.value===id)&&!(role==='text'&&m.customModels.some(x=>x.id===id))&&!(role==='decision'&&m.customDecisionModels.some(x=>x.id===id))))throw Error('Unsupported model library');
   if(selected!==''&&!library.includes(selected))throw Error('Add the model before selecting it');
  }
  if(!Array.isArray(m.transcriptionLibrary)||new Set(m.transcriptionLibrary).size!==m.transcriptionLibrary.length||m.transcriptionLibrary.some(id=>!settings.models.transcription.some(x=>x.value===id)&&!m.customSpeechModels.some(x=>x.id===id)))throw Error('Unsupported transcription library');
  if(m.transcriptionModel!==''&&!m.transcriptionLibrary.includes(m.transcriptionModel))throw Error('Add the transcription model before selecting it');
 }else if(group==='appearance'){
  const a=value as Preferences['appearance'];
  if(!settings.appearance.themes.includes(a.theme)||!settings.appearance.backgrounds.includes(a.background)||!settings.appearance.glass.includes(a.glass))throw Error('Unsupported appearance value');
 }else if(typeof value.downloads!=='boolean')throw Error('Downloads must be true or false');
 return value;
}

export const initialPreferenceNotes:PreferenceRecord[]=[
 {id:'settings-readme',path:'Settings/README.md',body:'# Settings\n\nThese records are shared with the Settings screen. Edit values in the JSON block; invalid changes are not applied.\n\nModel readiness and execution permissions are managed by the application. Do not store credentials here.\n\nPreview state is session-only.',version:1,history:[],protected:true},
 ...(['models','appearance','connection'] as const).map(group=>({id:'settings-'+group,path:preferencePath(group),body:formatPreference(group,defaults[group]),version:1,history:[],managed:true})),
];

export function preferenceGroup(path:string):PreferenceGroup|undefined{return (['models','appearance','connection'] as const).find(group=>preferencePath(group)===path);}
export function readPreference<G extends PreferenceGroup>(group:G,records:PreferenceRecord[]):Preferences[G]{
 const record=records.find(n=>n.id==='settings-'+group);
 if(!record)throw Error('Required settings record missing');
 return parsePreference(group,record.body);
}
export function readPreferenceWithFallback<G extends PreferenceGroup>(group:G,records:PreferenceRecord[]){
 try{return {value:readPreference(group,records),valid:true as const};}
 catch{return {value:readPreference(group,initialPreferenceNotes),valid:false as const};}
}
export function restoreDefaultPreferences<T extends PreferenceRecord>(records:T[]):T[]{
 const groups=['models','appearance','connection'] as const;let next=[...records];
 for(const group of groups){
  const current=next.find(record=>record.id==='settings-'+group),fallback=initialPreferenceNotes.find(record=>record.id==='settings-'+group)!;
  if(!current||current.path!==preferencePath(group)||current.managed!==true||current.protected)throw Error('Settings record unavailable · restore was not applied');
  const body=fallback.body;parsePreference(group,body);if(current.body===body)continue;
  const history=current.history??[];next=next.map(record=>record.id!==current.id?record:{...record,body,version:current.version+1,history:[...history,current.body],paths:[...(current.paths??history.map(()=>current.path)),current.path]});
 }
 return next;
}
export function updatePreference<G extends PreferenceGroup,T extends PreferenceRecord>(group:G,records:T[],change:(value:Preferences[G])=>Preferences[G]):T[]{
 const current=records.find(n=>n.id==='settings-'+group);
 if(!current)throw Error('Required settings record missing');
 const next=change(readPreference(group,records)),body=formatPreference(group,next);
 parsePreference(group,body);
 if(body===current.body)return records;
 return records.map(n=>n.id!==current.id?n:{...n,body,version:n.version+1,history:[...n.history,n.body],paths:[...(n.paths??n.history.map(()=>n.path)),n.path]});
}
