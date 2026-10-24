// @ts-expect-error Shared strict model declaration validator is JavaScript.
import {validateLocalModel} from '../../../dist/local-models.js';
import {OCR_LANGUAGES,type OcrLanguage} from './ocr-assets.ts';
import speechLanguages from './speech-languages.json' with {type:'json'};
import {settings} from './app-settings.ts';
import {MAX_AGENT_RESULT_CHARS,MAX_AGENT_TOOL_CALLS,SAFE_AGENT_TOOL_IDS} from './agent-loop.ts';
import {validateAppearancePalette,validateAppearancePaletteRegistry,type NamedAppearancePalette} from './appearance-palette.ts';
import {REPLY_STYLES,type ReplyStyle} from './reply-style.ts';
import {validateHarnessGuidance} from './harness-guidance.ts';
import {validateCustomVisionModel} from './custom-vision-assets.ts';

export type CustomLocalModel={id:string;label:string;role:'text';engine:'webml-qwen35'|'wllama-lfm2'|'wllama-qwen3';revision:string;file:{bytes:number;sha256:string};contextTokens:number;source?:{provider:'huggingface';repo:string;revision:string;file:string;license:string|null};inspection:{format:'GGUF';version:number;bytes:number;name:string;architecture:string;contextLength:number;tokenizer:string;chatTemplate:boolean;tokenCount:number;tensorCount:number;tensorTypes:number[];tensorExtentsChecked:boolean}};
export type CustomDecisionModel={id:string;label:string;role:'decision';engine:'onnx-d1-text';revision:string;files:{path:string;bytes:number;sha256:string}[];inspection:{format:'D1-ONNX';architecture:'d1_omni';contextTokens:16384;inputLimit:2048;scope:'text-only'}};
export type CustomSpeechModel={id:string;label:string;role:'speech';engine:'transformers-whisper-onnx';revision:string;files:{path:string;bytes:number;sha256:string}[];inspection:{format:'Whisper-ONNX';architecture:'whisper';device:'wasm';dtype:'q8';maxDurationSeconds:120}};
export type CustomVisionModel={id:string;label:string;role:'vision';engine:'transformers-lfm2-vl-onnx';revision:string;files:{path:string;bytes:number;sha256:string}[];inspection:{format:'LFM2-VL-ONNX';architecture:'lfm2_vl';device:'webgpu';dtype:'q4f16';maxImageTokens:256;scope:'image-text'}};
export type ModelSetSelection={textModel:string;decisionModel:string;transcriptionModel:string;ocrModel:string;visionModel:string};
export type UserModelSet={id:string;label:string;detail:string;models:ModelSetSelection};
export type LocalFont={id:string;label:string;format:'woff2'|'woff'|'ttf'|'otf';bytes:number;sha256:string};
export type HarnessProfile={id:string;label:string;enabledTools:string[];maxToolCalls:number;maxResultChars:number};
export type HarnessPreferences={replyStyle:ReplyStyle;userGuidance:string;activeProfileId:string;profiles:HarnessProfile[]};
export type PreferenceGroup='models'|'appearance'|'connection'|'harness';
export const PREFERENCE_SCHEMA_VERSION=1 as const;
export class UnsupportedPreferenceSchemaError extends Error{
 readonly group:PreferenceGroup;readonly version:number;
 constructor(group:PreferenceGroup,version:number){super('Settings use a newer format · update the app');this.name='UnsupportedPreferenceSchemaError';this.group=group;this.version=version;}
}
const defaults={
 models:{schemaVersion:PREFERENCE_SCHEMA_VERSION,customSets:[] as UserModelSet[],customModels:[] as CustomLocalModel[],customDecisionModels:[] as CustomDecisionModel[],customSpeechModels:[] as CustomSpeechModel[],customVisionModels:[] as CustomVisionModel[],visionModel:'',visionLibrary:[] as string[],ocrModel:'',ocrLibrary:[] as string[],ocrLanguage:'eng+jpn' as OcrLanguage,transcriptionLanguage:'en',textLibrary:[settings.defaults.textModel,'2B','lfm25-230m-qad-q4-0'] as string[],decisionLibrary:[] as string[],textModel:settings.defaults.textModel,decisionModel:settings.defaults.decisionModel,transcriptionModel:settings.defaults.transcriptionModel,transcriptionLibrary:settings.defaults.transcriptionModel?[settings.defaults.transcriptionModel]:[] as string[]},
 appearance:{schemaVersion:PREFERENCE_SCHEMA_VERSION,theme:settings.defaults.theme,background:settings.defaults.background,glass:settings.defaults.glass,fontFamily:settings.defaults.fontFamily,fonts:[] as LocalFont[],paletteRegistry:[] as NamedAppearancePalette[],activePaletteId:''},
 connection:{schemaVersion:PREFERENCE_SCHEMA_VERSION,downloads:settings.defaults.downloads,diagnosticLogs:false},
 harness:{schemaVersion:PREFERENCE_SCHEMA_VERSION,replyStyle:'balanced' as ReplyStyle,userGuidance:'',activeProfileId:'standard',profiles:[
  {id:'standard',label:'Standard',enabledTools:[...SAFE_AGENT_TOOL_IDS],maxToolCalls:MAX_AGENT_TOOL_CALLS,maxResultChars:MAX_AGENT_RESULT_CHARS},
  {id:'source-first',label:'Source first',enabledTools:['memory.search','memory.read'],maxToolCalls:2,maxResultChars:6000},
  {id:'conversation',label:'Conversation',enabledTools:[],maxToolCalls:0,maxResultChars:MAX_AGENT_RESULT_CHARS},
 ] as HarnessProfile[]},
};
export type Preferences=typeof defaults;
export type PreferenceRecord={id:string;path:string;body:string;version:number;history:string[];paths?:string[];managed?:boolean;protected?:boolean};
export const preferencePath=(group:PreferenceGroup)=>'Settings/'+group+'.md';
export function formatPreference<G extends PreferenceGroup>(group:G,value:Omit<Preferences[G],'schemaVersion'>|Preferences[G]){return '# '+group[0].toUpperCase()+group.slice(1)+'\n\n```json\n'+JSON.stringify({...value,schemaVersion:PREFERENCE_SCHEMA_VERSION},null,2)+'\n```\n';}

export function parsePreference<G extends PreferenceGroup>(group:G,body:string):Preferences[G]{
 const block=body.match(/^# [^\n]+\n\n```json\n([\s\S]+)\n```\n?$/);
 if(!block)throw Error('Use one JSON block below the heading');
 const value=JSON.parse(block[1]);
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid settings object');
 const schemaVersion=value.schemaVersion===undefined?0:value.schemaVersion;
 if(!Number.isSafeInteger(schemaVersion)||schemaVersion<0)throw Error('Invalid settings schema version');
 if(schemaVersion>PREFERENCE_SCHEMA_VERSION)throw new UnsupportedPreferenceSchemaError(group,schemaVersion);
 if(schemaVersion===0){
  // v0 records predate an explicit schema stamp; migrate only those known legacy shapes.
  if(group==='models'&&!('textLibrary' in value)&&!('decisionLibrary' in value)){value.textLibrary=value.textModel?[value.textModel]:[];value.decisionLibrary=value.decisionModel?[value.decisionModel]:[];}
  if(group==='models'&&!('transcriptionLanguage' in value))value.transcriptionLanguage='en';
  if(group==='models'&&!('ocrModel' in value)&&!('ocrLibrary' in value)&&!('ocrLanguage' in value)){value.ocrModel='';value.ocrLibrary=[];value.ocrLanguage='eng+jpn';}
  if(group==='models'&&!('visionModel' in value)&&!('visionLibrary' in value)){value.visionModel='';value.visionLibrary=[];}
  if(group==='models'&&!('customModels' in value))value.customModels=[];
  if(group==='models'&&!('customDecisionModels' in value))value.customDecisionModels=[];
  if(group==='models'&&!('customSpeechModels' in value))value.customSpeechModels=[];
  if(group==='models'&&!('customVisionModels' in value))value.customVisionModels=[];
  if(group==='models'&&!('customSets' in value))value.customSets=[];
  if(group==='appearance'&&!('fontFamily' in value)){value.fontFamily='system';value.fonts=[];}
  if(group==='appearance'){
   if(!('paletteRegistry' in value)){
    const legacyPalette=validateAppearancePalette('palette' in value?value.palette:null);
    value.paletteRegistry=legacyPalette?[{id:'palette-legacy',...legacyPalette}]:[];
    value.activePaletteId=legacyPalette?'palette-legacy':'';
    delete value.palette;
   }else if('palette' in value)throw Error('Ambiguous legacy palette setting');
   if(!('activePaletteId' in value))value.activePaletteId='';
  }
  if(group==='connection'&&!('diagnosticLogs' in value))value.diagnosticLogs=false;
  if(group==='harness'&&!('replyStyle' in value))value.replyStyle='balanced';
  if(group==='harness'&&!('userGuidance' in value))value.userGuidance='';
  value.schemaVersion=PREFERENCE_SCHEMA_VERSION;
 }
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==Object.keys(defaults[group]).sort().join('|'))throw Error('Unknown or missing setting');
 if(group==='models'){
  const m=value as Preferences['models'];if(!Array.isArray(m.customModels)||m.customModels.length>64||!Array.isArray(m.customDecisionModels)||m.customDecisionModels.length>32||!Array.isArray(m.customSpeechModels)||m.customSpeechModels.length>32||!Array.isArray(m.customVisionModels)||m.customVisionModels.length>32||!Array.isArray(m.customSets)||m.customSets.length>32)throw Error('Unsupported custom model registry');m.customModels=m.customModels.map(validateLocalModel);m.customDecisionModels=m.customDecisionModels.map(validateLocalModel);m.customSpeechModels=m.customSpeechModels.map(validateLocalModel);m.customVisionModels=m.customVisionModels.map(validateCustomVisionModel);if(m.customModels.some(x=>x.role!=='text')||m.customDecisionModels.some(x=>x.role!=='decision')||m.customSpeechModels.some(x=>x.role!=='speech')||new Set([...m.customModels,...m.customDecisionModels,...m.customSpeechModels,...m.customVisionModels].map(x=>x.id)).size!==m.customModels.length+m.customDecisionModels.length+m.customSpeechModels.length+m.customVisionModels.length)throw Error('Duplicate or mismatched custom model');if(!Array.isArray(m.visionLibrary)||new Set(m.visionLibrary).size!==m.visionLibrary.length||m.visionLibrary.some(id=>id!==settings.models.vision[0].value&&!m.customVisionModels.some(model=>model.id===id))||m.visionModel!==''&&!m.visionLibrary.includes(m.visionModel))throw Error('Unsupported vision model');if(!Array.isArray(m.ocrLibrary)||new Set(m.ocrLibrary).size!==m.ocrLibrary.length||m.ocrLibrary.some(id=>id!=='tesseract-7')||m.ocrModel!==''&&!m.ocrLibrary.includes(m.ocrModel)||!OCR_LANGUAGES.includes(m.ocrLanguage))throw Error('Unsupported image reader');if(!speechLanguages.includes(m.transcriptionLanguage))throw Error('Unsupported transcription language');
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
   if(!models||typeof models!=='object'||Array.isArray(models)||Object.keys(models).sort().join('|')!=='decisionModel|ocrModel|textModel|transcriptionModel|visionModel'||typeof models.textModel!=='string'||!m.textLibrary.includes(models.textModel)||typeof models.decisionModel!=='string'||models.decisionModel!==''&&!m.decisionLibrary.includes(models.decisionModel)||typeof models.transcriptionModel!=='string'||models.transcriptionModel!==''&&!m.transcriptionLibrary.includes(models.transcriptionModel)||typeof models.ocrModel!=='string'||models.ocrModel!==''&&!m.ocrLibrary.includes(models.ocrModel)||typeof models.visionModel!=='string'||models.visionModel!==''&&!m.visionLibrary.includes(models.visionModel))throw Error('Custom model set references an unregistered model');
  }
 }else if(group==='appearance'){
  const a=value as Preferences['appearance'];
  if(!settings.appearance.themes.includes(a.theme)||!settings.appearance.backgrounds.includes(a.background)||!settings.appearance.glass.includes(a.glass))throw Error('Unsupported appearance value');
  if(typeof a.fontFamily!=='string'||a.fontFamily!=='system'&&!a.fonts?.some(font=>font.id===a.fontFamily)||!Array.isArray(a.fonts)||a.fonts.length>32||new Set(a.fonts.map(font=>font?.id)).size!==a.fonts.length||a.fonts.some(font=>!font||!/^font-[a-f0-9]{64}$/.test(font.id)||typeof font.label!=='string'||font.label.length>128||!['woff2','woff','ttf','otf'].includes(font.format)||!Number.isSafeInteger(font.bytes)||font.bytes<1||font.bytes>20*1024*1024||font.sha256!==font.id.slice(5)))throw Error('Invalid local font registry');
  const validated=validateAppearancePaletteRegistry(a.paletteRegistry,a.activePaletteId);a.paletteRegistry=validated.paletteRegistry;a.activePaletteId=validated.activePaletteId;
 }else if(group==='connection'){
  if(typeof value.downloads!=='boolean'||typeof value.diagnosticLogs!=='boolean')throw Error('Invalid connection preference');
 }else {
  const harness=value as Preferences['harness'];
  if(typeof harness.replyStyle!=='string'||!REPLY_STYLES.includes(harness.replyStyle as ReplyStyle)||!validateHarnessGuidance(harness.userGuidance)||typeof harness.activeProfileId!=='string'||!Array.isArray(harness.profiles)||!harness.profiles.length||harness.profiles.length>12)throw Error('Invalid harness profile registry or user guidance');
  const ids=new Set<string>();
  for(const profile of harness.profiles){
   if(!profile||typeof profile!=='object'||Array.isArray(profile)||Object.keys(profile).sort().join('|')!=='enabledTools|id|label|maxResultChars|maxToolCalls')throw Error('Invalid harness profile fields');
   if(typeof profile.id!=='string'||!/^[a-z][a-z0-9-]{0,31}$/.test(profile.id)||ids.has(profile.id)||typeof profile.label!=='string'||!profile.label.trim()||profile.label.length>48)throw Error('Invalid harness profile identity');
   ids.add(profile.id);
   if(!Array.isArray(profile.enabledTools)||profile.enabledTools.length>12||new Set(profile.enabledTools).size!==profile.enabledTools.length||profile.enabledTools.some(id=>typeof id!=='string'||(!SAFE_AGENT_TOOL_IDS.includes(id as typeof SAFE_AGENT_TOOL_IDS[number])&&!/^user\.[a-z][a-z0-9-]{0,47}$/.test(id))))throw Error('Unsupported harness tool');
   if(!Number.isSafeInteger(profile.maxToolCalls)||profile.maxToolCalls<0||profile.maxToolCalls>MAX_AGENT_TOOL_CALLS||!Number.isSafeInteger(profile.maxResultChars)||profile.maxResultChars<256||profile.maxResultChars>MAX_AGENT_RESULT_CHARS||!profile.enabledTools.length&&profile.maxToolCalls!==0)throw Error('Harness profile budget exceeds app limits');
  }
  if(!ids.has(harness.activeProfileId))throw Error('Active harness profile is unavailable');
 }
 return value;
}

export const initialPreferenceNotes:PreferenceRecord[]=[
 {id:'settings-readme',path:'Settings/README.md',body:'# Settings\n\nThese files are local Memory records shared with the Settings screen. They keep revision history; restore and Undo add revisions instead of erasing earlier values.\n\n- `Settings/models.md` — registered models, selected roles, and named model sets. Save current choices as a set or edit the validated customSets list. Import and inspect model files in Settings; a declaration does not mean the model is prepared or runnable.\n- `Settings/appearance.md` — theme, background, local fonts and named color palettes. Add or edit palettes in this file; choose a saved palette in Settings. Add fonts through Settings so their bytes and hash are checked.\n- `Settings/connection.md` — asset download policy and diagnostic logging. Offline inference and personal data stay on this device.\n- `Settings/harness.md` — reply style, user guidance and agent profiles. Profiles can use only registered tools and may lower app limits.\n- `Tools/user.<id>/SKILL.md` + `tool.js` — optional local tool packages. Review and test code before enabling it in a profile.\n\nEdit a supported value here or ask chat to propose a change. Review Before and After, then save explicitly. Invalid changes are not applied. New setting types need an app schema, validator and consumer; adding a Markdown file alone does not make it active. Memory definitions cannot grant network, write, delete or other app capabilities. Do not store credentials here.',version:1,history:[],protected:true},
 ...(['models','appearance','connection','harness'] as const).map(group=>({id:'settings-'+group,path:preferencePath(group),body:formatPreference(group,defaults[group]),version:1,history:[],managed:true})),
];

export function preferenceGroup(path:string):PreferenceGroup|undefined{return (['models','appearance','connection','harness'] as const).find(group=>preferencePath(group)===path);}
export function readPreference<G extends PreferenceGroup>(group:G,records:PreferenceRecord[]):Preferences[G]{
 const record=records.find(n=>n.id==='settings-'+group);
 if(!record)throw Error('Required settings record missing');
 return parsePreference(group,record.body);
}
export function readPreferenceWithFallback<G extends PreferenceGroup>(group:G,records:PreferenceRecord[]){
 try{return {value:readPreference(group,records),valid:true as const,unsupportedSchema:false as const};}
 catch(error){
  const record=records.find(n=>n.id==='settings-'+group);
  if(record&&Array.isArray(record.history))for(let index=record.history.length-1;index>=0;index--){
   const body=record.history[index];
   if(typeof body!=='string'||record.paths?.[index]&&record.paths[index]!==preferencePath(group))continue;
   try{return {value:parsePreference(group,body),valid:false as const,unsupportedSchema:error instanceof UnsupportedPreferenceSchemaError};}catch{}
  }
  return {value:readPreference(group,initialPreferenceNotes),valid:false as const,unsupportedSchema:error instanceof UnsupportedPreferenceSchemaError};
 }
}
export function restoreDefaultPreferences<T extends PreferenceRecord>(records:T[]):T[]{
 const groups=['models','appearance','connection','harness'] as const;let next=[...records];
 for(const group of groups){
  const current=next.find(record=>record.id==='settings-'+group),fallback=initialPreferenceNotes.find(record=>record.id==='settings-'+group)!;
  if(!current||current.path!==preferencePath(group)||current.managed!==true||current.protected)throw Error('Settings record unavailable · restore was not applied');
  const body=group==='connection'?formatPreference('connection',{downloads:false,diagnosticLogs:false}):fallback.body;parsePreference(group,body);if(current.body===body)continue;
  const history=current.history??[];next=next.map(record=>record.id!==current.id?record:{...record,body,version:current.version+1,history:[...history,current.body],paths:[...(current.paths??history.map(()=>current.path)),current.path]});
 }
 return next;
}
export function recoverPreferenceRecord<T extends PreferenceRecord>(group:PreferenceGroup,records:T[]):T[]{
 const current=records.find(record=>record.id==='settings-'+group);
 if(!current){const fallback=initialPreferenceNotes.find(record=>record.id==='settings-'+group)!;if(records.some(record=>record.path.toLowerCase()===fallback.path.toLowerCase()))throw Error('Settings path conflict · recovery was not applied');return [...records,structuredClone(fallback) as T];}
 if(current.path!==preferencePath(group)||current.managed!==true||current.protected)throw Error('Settings record unavailable · recovery was not applied');
 try{parsePreference(group,current.body);return records;}catch{
  // Recovery is the explicit opt-in that may move this setting back to the
  // latest compatible revision or factory default. Keep the unsupported body.
  const body=formatPreference(group,readPreferenceWithFallback(group,records).value);parsePreference(group,body);
  const history=Array.isArray(current.history)?current.history:[];
  return records.map(record=>record.id!==current.id?record:{...record,body,version:current.version+1,history:[...history,current.body],paths:[...(current.paths??history.map(()=>current.path)),current.path]});
 }
}
export function updatePreference<G extends PreferenceGroup,T extends PreferenceRecord>(group:G,records:T[],change:(value:Preferences[G])=>Preferences[G]):T[]{
 const current=records.find(n=>n.id==='settings-'+group);
 if(!current)throw Error('Required settings record missing');
 try{parsePreference(group,current.body);}catch(error){if(error instanceof UnsupportedPreferenceSchemaError)throw error;}
 const next=change(readPreferenceWithFallback(group,records).value),body=formatPreference(group,next);
 parsePreference(group,body);
 if(body===current.body)return records;
 const history=Array.isArray(current.history)?current.history:[];
 return records.map(n=>n.id!==current.id?n:{...n,body,version:current.version+1,history:[...history,current.body],paths:[...(current.paths??history.map(()=>current.path)),current.path]});
}
