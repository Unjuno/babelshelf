import {settings} from './app-settings.ts';

export type PreferenceGroup='models'|'appearance'|'connection';
const defaults={
 models:{textLibrary:[settings.defaults.textModel] as string[],decisionLibrary:[] as string[],textModel:settings.defaults.textModel,decisionModel:settings.defaults.decisionModel,transcriptionModel:settings.defaults.transcriptionModel,transcriptionLibrary:settings.defaults.transcriptionModel?[settings.defaults.transcriptionModel]:[] as string[]},
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
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==Object.keys(defaults[group]).sort().join('|'))throw Error('Unknown or missing setting');
 if(group==='models'){
  const m=value as Preferences['models'];
  for(const [role,library,selected] of [['text',m.textLibrary,m.textModel],['decision',m.decisionLibrary,m.decisionModel]] as const){
   if(!Array.isArray(library)||new Set(library).size!==library.length||library.some(id=>!id||!settings.models[role].some(x=>x.value===id)))throw Error('Unsupported model library');
   if(selected!==''&&!library.includes(selected))throw Error('Add the model before selecting it');
  }
  if(!Array.isArray(m.transcriptionLibrary)||new Set(m.transcriptionLibrary).size!==m.transcriptionLibrary.length||m.transcriptionLibrary.some(id=>!settings.models.transcription.some(x=>x.value===id)))throw Error('Unsupported transcription library');
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
export function updatePreference<G extends PreferenceGroup,T extends PreferenceRecord>(group:G,records:T[],change:(value:Preferences[G])=>Preferences[G]):T[]{
 const current=records.find(n=>n.id==='settings-'+group);
 if(!current)throw Error('Required settings record missing');
 const next=change(readPreference(group,records)),body=formatPreference(group,next);
 parsePreference(group,body);
 if(body===current.body)return records;
 return records.map(n=>n.id!==current.id?n:{...n,body,version:n.version+1,history:[...n.history,n.body],paths:[...(n.paths??n.history.map(()=>n.path)),n.path]});
}
