import {settings} from './app-settings.ts';
import {MAX_AGENT_RESULT_CHARS,MAX_CONFIGURED_AGENT_TOOLS,SAFE_AGENT_TOOL_IDS} from './agent-loop.ts';
import {MAX_TURN_GENERATION_MS,MAX_TURN_GENERATION_TOKENS} from './turn-inference-budget.ts';
import {validateAppearancePalette} from './appearance-palette.ts';
import {createAppearancePreferenceDefaults,validateAppearancePreference,type AppearancePreferences} from './appearance-preference-contract.ts';
import {createConnectionPreferenceDefaults,validateConnectionPreference} from './connection-preference-contract.ts';
import {REPLY_STYLES,type ReplyStyle} from './reply-style-contract.ts';
import type {HarnessPreferences,HarnessProfile} from './harness-preference-contract.ts';
import {validateHarnessGuidance} from './harness-guidance.ts';
import {createModelPreferenceDefaults,validateModelPreferences,type ModelPreferences} from './model-preference-contract.ts';

export type PreferenceGroup='models'|'appearance'|'connection'|'harness';
export const PREFERENCE_SCHEMA_VERSION=7 as const;
export class UnsupportedPreferenceSchemaError extends Error{
 readonly group:PreferenceGroup;readonly version:number;
 constructor(group:PreferenceGroup,version:number){super('Settings use a newer format · update the app');this.name='UnsupportedPreferenceSchemaError';this.group=group;this.version=version;}
}
const defaults={
 models:createModelPreferenceDefaults(PREFERENCE_SCHEMA_VERSION),
 appearance:createAppearancePreferenceDefaults(PREFERENCE_SCHEMA_VERSION),
 connection:createConnectionPreferenceDefaults(PREFERENCE_SCHEMA_VERSION),
 harness:{schemaVersion:PREFERENCE_SCHEMA_VERSION,replyStyle:'balanced' as ReplyStyle,userGuidance:'',activeProfileId:'standard',profiles:[
  {id:'standard',label:'Standard',enabledTools:['memory.search','memory.list','memory.read','memory.sources','math.calculate','time.now'],maxToolCalls:null,maxResultChars:MAX_AGENT_RESULT_CHARS,maxGenerationTokens:8192,maxGenerationMs:300_000},
  {id:'source-first',label:'Source first',enabledTools:['memory.search','memory.list','memory.read','memory.sources'],maxToolCalls:null,maxResultChars:6000,maxGenerationTokens:8192,maxGenerationMs:300_000},
  {id:'conversation',label:'Conversation',enabledTools:[],maxToolCalls:0,maxResultChars:MAX_AGENT_RESULT_CHARS,maxGenerationTokens:8192,maxGenerationMs:300_000},
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
 // Project only known missing fields from older schemas; never rewrite the
 // stored body during a read or guess over a present invalid value.
 if(schemaVersion<PREFERENCE_SCHEMA_VERSION&&group==='models'){
  if(!('textLibrary' in value))value.textLibrary=value.textModel?[value.textModel]:[];
  if(!('decisionLibrary' in value))value.decisionLibrary=value.decisionModel?[value.decisionModel]:[];
  if(!('transcriptionLanguage' in value))value.transcriptionLanguage='en';
  if(!('ocrModel' in value))value.ocrModel='';
  if(!('ocrLibrary' in value))value.ocrLibrary=value.ocrModel?[value.ocrModel]:[];
  if(!('ocrLanguage' in value))value.ocrLanguage='eng+jpn';
  if(!('visionModel' in value))value.visionModel='';
  if(!('visionLibrary' in value))value.visionLibrary=value.visionModel?[value.visionModel]:[];
  if(!('customModels' in value))value.customModels=[];
  if(!('customDecisionModels' in value))value.customDecisionModels=[];
  if(!('customSpeechModels' in value))value.customSpeechModels=[];
  if(!('customVisionModels' in value))value.customVisionModels=[];
  if(!('customSets' in value))value.customSets=[];
  // Preserve the selected model if the older record predates a role library.
  if(!('lfm3ContextTokens' in value))value.lfm3ContextTokens=8192;
 }
 if(schemaVersion<6&&group==='models'){
  if(!('searchModel' in value))value.searchModel='';
  if(!('searchLibrary' in value))value.searchLibrary=[];
  if(Array.isArray(value.customSets))for(const set of value.customSets){if(set?.models&&typeof set.models==='object'&&!('searchModel' in set.models))set.models.searchModel='';}
 }
 if(schemaVersion<4&&group==='models'){
  // The pre-release catalog now exposes only the supported core text set.
  // Keep imported/custom models and their files; replace references to retired
  // built-ins in local settings and saved presets with the current default.
  const models=value as ModelPreferences;
  const valid=(id:string)=>settings.models.text.some(model=>model.value===id)||models.customModels.some(model=>model.id===id);
  if(Array.isArray(models.textLibrary))models.textLibrary=models.textLibrary.filter(valid);
  if(typeof models.textModel!=='string'||!valid(models.textModel))models.textModel=settings.defaults.textModel;
  if(!models.textLibrary.includes(models.textModel))models.textLibrary.push(models.textModel);
  if(Array.isArray(models.customSets))for(const set of models.customSets){
   if(set?.models&&typeof set.models.textModel==='string'&&!valid(set.models.textModel))set.models.textModel=models.textModel;
  }
 }
 if(schemaVersion<7&&group==='models'){
  // D1 3B was shown as selectable without a matching pinned browser adapter.
  // Retire that unusable selection while preserving other models and history.
  if(value.decisionModel==='d1-3B')value.decisionModel='';
  if(Array.isArray(value.decisionLibrary))value.decisionLibrary=value.decisionLibrary.filter((id:unknown)=>id!=='d1-3B');
  if(Array.isArray(value.customSets))for(const set of value.customSets){if(set?.models?.decisionModel==='d1-3B')set.models.decisionModel='';}
 }
 if(schemaVersion<PREFERENCE_SCHEMA_VERSION&&group==='appearance'){
  if(!('fontFamily' in value))value.fontFamily='system';
  if(!('fonts' in value))value.fonts=[];
  if(!('paletteRegistry' in value)){
   const legacyPalette=validateAppearancePalette('palette' in value?value.palette:null);
   value.paletteRegistry=legacyPalette?[{id:'palette-legacy',...legacyPalette}]:[];
   if(!('activePaletteId' in value))value.activePaletteId=legacyPalette?'palette-legacy':'';
   delete value.palette;
  }else if('palette' in value)throw Error('Ambiguous legacy palette setting');
  if(!('activePaletteId' in value))value.activePaletteId='';
 }
 if(schemaVersion<PREFERENCE_SCHEMA_VERSION&&group==='connection'&&!('diagnosticLogs' in value))value.diagnosticLogs=false;
 if(schemaVersion<5&&group==='connection'&&!('rustxngEndpoint' in value))value.rustxngEndpoint='';
 if(schemaVersion<PREFERENCE_SCHEMA_VERSION&&group==='harness'&&!('replyStyle' in value))value.replyStyle='balanced';
 if(schemaVersion<PREFERENCE_SCHEMA_VERSION&&group==='harness'&&!('userGuidance' in value))value.userGuidance='';
 if(group==='harness'&&schemaVersion<PREFERENCE_SCHEMA_VERSION&&Array.isArray(value.profiles))for(const profile of value.profiles){if(profile&&typeof profile==='object'){if(!('maxGenerationTokens' in profile))profile.maxGenerationTokens=8192;if(!('maxGenerationMs' in profile))profile.maxGenerationMs=300_000;}}
 if(schemaVersion<PREFERENCE_SCHEMA_VERSION)value.schemaVersion=PREFERENCE_SCHEMA_VERSION;
 // This defaults migration belongs only to schema 1 -> 2. Later schema
 // additions must preserve explicit tools and limits, even when they match
 // former built-in defaults such as an eight-call budget.
 if(group==='harness'&&schemaVersion<2&&Array.isArray(value.profiles)){
  // Project only untouched built-in defaults; preserve all customized profile values.
  for(const profile of value.profiles){
   const oldStandard=['math.calculate','memory.read','memory.search'].sort().join('|');
   if(profile?.id==='standard'&&profile.label==='Standard'&&profile.maxResultChars===MAX_AGENT_RESULT_CHARS&&Array.isArray(profile.enabledTools)&&profile.enabledTools.slice().sort().join('|')===oldStandard&&(profile.maxToolCalls===null||profile.maxToolCalls===8)){
    profile.enabledTools=['memory.search','memory.list','memory.read','math.calculate','time.now'];profile.maxToolCalls=null;
   }
   if(profile?.id==='source-first'&&profile.label==='Source first'&&profile.maxResultChars===6000&&Array.isArray(profile.enabledTools)&&['memory.read|memory.search','memory.list|memory.read|memory.search'].includes(profile.enabledTools.slice().sort().join('|'))&&(profile.maxToolCalls===null||profile.maxToolCalls===2)){
    profile.enabledTools=['memory.search','memory.list','memory.read'];profile.maxToolCalls=null;
   }
   if(profile?.id==='standard'&&profile.label==='Standard'&&profile.maxToolCalls===8&&profile.maxResultChars===MAX_AGENT_RESULT_CHARS&&Array.isArray(profile.enabledTools)&&['math.calculate','memory.list','memory.read','memory.search','time.now'].sort().join('|')===profile.enabledTools.slice().sort().join('|'))profile.maxToolCalls=null;
   if(profile?.id==='source-first'&&profile.label==='Source first'&&profile.maxToolCalls===2&&profile.maxResultChars===6000&&Array.isArray(profile.enabledTools)&&profile.enabledTools.slice().sort().join('|')==='memory.read|memory.search')profile.maxToolCalls=null;
  }
 }
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==Object.keys(defaults[group]).sort().join('|'))throw Error('Unknown or missing setting');
 if(group==='models'){
  validateModelPreferences(value);
 }else if(group==='appearance'){
  validateAppearancePreference(value as AppearancePreferences);
 }else if(group==='connection'){
  validateConnectionPreference(value as Preferences['connection']);
 }else {
  const harness=value as Preferences['harness'];
  if(typeof harness.replyStyle!=='string'||!REPLY_STYLES.includes(harness.replyStyle as ReplyStyle)||!validateHarnessGuidance(harness.userGuidance)||typeof harness.activeProfileId!=='string'||!Array.isArray(harness.profiles)||!harness.profiles.length||harness.profiles.length>12)throw Error('Invalid harness profile registry or user guidance');
  const ids=new Set<string>();
  for(const profile of harness.profiles){
   if(!profile||typeof profile!=='object'||Array.isArray(profile)||Object.keys(profile).sort().join('|')!=='enabledTools|id|label|maxGenerationMs|maxGenerationTokens|maxResultChars|maxToolCalls')throw Error('Invalid harness profile fields');
   if(typeof profile.id!=='string'||!/^[a-z][a-z0-9-]{0,31}$/.test(profile.id)||ids.has(profile.id)||typeof profile.label!=='string'||!profile.label.trim()||profile.label.length>48)throw Error('Invalid harness profile identity');
   ids.add(profile.id);
   if(!Array.isArray(profile.enabledTools)||profile.enabledTools.length>MAX_CONFIGURED_AGENT_TOOLS||new Set(profile.enabledTools).size!==profile.enabledTools.length||profile.enabledTools.some(id=>typeof id!=='string'||(!SAFE_AGENT_TOOL_IDS.includes(id as typeof SAFE_AGENT_TOOL_IDS[number])&&!/^user\.[a-z][a-z0-9-]{0,47}$/.test(id))))throw Error('Unsupported harness tool');
   if(profile.maxToolCalls!==null&&(!Number.isSafeInteger(profile.maxToolCalls)||profile.maxToolCalls<0)||!Number.isSafeInteger(profile.maxResultChars)||profile.maxResultChars<256||profile.maxResultChars>MAX_AGENT_RESULT_CHARS||profile.maxGenerationTokens===undefined||profile.maxGenerationTokens!==null&&(!Number.isSafeInteger(profile.maxGenerationTokens)||typeof profile.maxGenerationTokens!=='number'||profile.maxGenerationTokens<256||profile.maxGenerationTokens>MAX_TURN_GENERATION_TOKENS)||profile.maxGenerationMs===undefined||profile.maxGenerationMs!==null&&(!Number.isSafeInteger(profile.maxGenerationMs)||typeof profile.maxGenerationMs!=='number'||profile.maxGenerationMs<1_000||profile.maxGenerationMs>MAX_TURN_GENERATION_MS)||!profile.enabledTools.length&&profile.maxToolCalls!==0)throw Error('Harness profile budget is invalid');
  }
  if(!ids.has(harness.activeProfileId))throw Error('Active harness profile is unavailable');
 }
 return value;
}

export const initialPreferenceNotes:PreferenceRecord[]=[
 {id:'settings-readme',path:'Settings/README.md',body:'# Settings\n\nThese files are local Memory records shared with the Settings screen. They keep revision history; restore and Undo add revisions instead of erasing earlier values.\n\n- `Settings/models.md` — registered models, selected roles, and named model sets. Save current choices as a set or edit the validated customSets list. Import and inspect model files in Settings; a declaration does not mean the model is prepared or runnable.\n- `Settings/appearance.md` — theme, background, local fonts and named color palettes. Add or edit palettes in this file; choose a saved palette in Settings. Add fonts through Settings so their bytes and hash are checked.\n- `Settings/connection.md` — asset download policy and diagnostic logging. Offline inference and personal data stay on this device.\n- `Settings/harness.md` — reply style, bounded user-defined system-prompt extension and agent profiles. App-owned system rules remain later and authoritative. A profile may optionally set per-turn tool-call, generated-token and generation-time limits; each defaults to no profile limit. Token/time limits cover every text generation in one Send. The model remains free to use enabled read-only tools until context, storage, cancellation or an explicitly configured budget ends the turn.\n- `Tools/user.<id>/SKILL.md` + `tool.js` — local tool packages. Saving a package adds it to the active profile; its local code can run on a later matching chat request.\n\nEdit a supported value here or ask chat to propose a change. Review Before and After, then save explicitly. Invalid changes are not applied. New setting types need an app schema, validator and consumer; adding a Markdown file alone does not make it active. Memory definitions cannot grant network, write, delete or other app capabilities. Do not store credentials here.',version:1,history:[],protected:true},
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
  const body=group==='connection'?formatPreference('connection',{downloads:false,diagnosticLogs:false,rustxngEndpoint:''}):fallback.body;parsePreference(group,body);if(current.body===body)continue;
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
 // Normal edits must never turn a damaged record into a fallback-derived save.
 // Recovery is an explicit, separately reviewed operation that preserves the
 // bad current bytes in revision history before edits can resume.
 const currentValue=parsePreference(group,current.body);
 const next=change(currentValue),body=formatPreference(group,next);
 parsePreference(group,body);
 if(body===current.body)return records;
 const history=Array.isArray(current.history)?current.history:[];
 return records.map(n=>n.id!==current.id?n:{...n,body,version:current.version+1,history:[...history,current.body],paths:[...(current.paths??history.map(()=>current.path)),current.path]});
}
