import {prepareCorrection} from './note-corrections.ts';
import {settingsCorrectionTarget} from './settings-corrections.ts';
import {initialPreferenceNotes,parsePreference,updatePreference,type HarnessPreferences,type PreferenceRecord} from './preference-records.ts';
import {MAX_CONFIGURED_AGENT_TOOLS} from './agent-loop.ts';
import type {ToolPackage} from './tools/tool-registry.ts';

/** A three-call setting may be intentional; only a reviewed proposal changes it. */
export async function prepareToolLimitReview(records:any[]){
 const targets=records.filter(record=>record.id==='settings-harness');
 if(targets.length!==1)throw Error('Harness settings unavailable');
 const target=targets[0],{group,value}=settingsCorrectionTarget(target);
 if(group!=='harness')throw Error('Harness settings unavailable');
 const preferences=value as unknown as HarnessPreferences;
 const profile=preferences.profiles.find(item=>item.id===preferences.activeProfileId);
 if(!profile||profile.maxToolCalls!==3)throw Error('No three-call limit to review');
 const profiles=preferences.profiles.map(item=>item.id===profile.id?{...item,maxToolCalls:null}:item);
 return prepareCorrection(target,'Review tool call limit',JSON.stringify({action:'patch',changes:{profiles}}),records);
}

/** Identify only the exact schema-1 Standard default from the 3-tool/3-call era. */
function legacyStandardDefault(record:any){
 if(!record||record.id!=='settings-harness'||record.path&&record.path!=='Settings/harness.md'||record.revisions?.at(-1)?.path&&record.revisions.at(-1)?.path!=='Settings/harness.md'||record.managed!==true&&record.ui?.managed!==true||record.protected||record.ui?.protected)return null;
 try{
  const body=record.body??record.revisions?.at(-1)?.body;if(typeof body!=='string')return null;
  const match=body.match(/^# [^\n]+\n\n```json\n([\s\S]+)\n```\n?$/);if(!match)return null;
  const raw=JSON.parse(match[1]);if(raw?.schemaVersion!==1||raw.activeProfileId!=='standard'||raw.replyStyle!=='balanced'||raw.userGuidance!=='')return null;
  const profile=raw.profiles?.find((item:any)=>item?.id==='standard');
  return profile&&profile.label==='Standard'&&profile.maxToolCalls===3&&profile.maxResultChars===8000&&Array.isArray(profile.enabledTools)&&profile.enabledTools.slice().sort().join('|')==='math.calculate|memory.read|memory.search'&&Object.keys(profile).sort().join('|')==='enabledTools|id|label|maxResultChars|maxToolCalls'?raw:null;
 }catch{return null;}
}
export function hasLegacyStandardDefault(record:any){return legacyStandardDefault(record)!==null;}

/** Offer a reviewed migration for a proven built-in default, never for an edited profile. */
export async function prepareLegacyStandardReview(records:PreferenceRecord[]){
 const targets=records.filter(record=>record.id==='settings-harness');if(targets.length!==1||!hasLegacyStandardDefault(targets[0]))throw Error('No untouched legacy Standard default');
 const target=targets[0],legacy=legacyStandardDefault(target);if(!legacy)throw Error('No untouched legacy Standard default');
 const current=settingsCorrectionTarget(target).value as unknown as HarnessPreferences;
 const factory=initialPreferenceNotes.find(record=>record.id==='settings-harness');if(!factory)throw Error('Current Standard default unavailable');
 const currentDefault=parsePreference('harness',factory.body) as unknown as HarnessPreferences;
 const standard=current.profiles.find(item=>item.id==='standard'),nextStandard=currentDefault.profiles.find(item=>item.id==='standard');
 if(!standard||!nextStandard)throw Error('Standard profile unavailable');
 const profiles=legacy.profiles.map((item:any)=>item.id==='standard'?structuredClone(nextStandard):structuredClone(item));
 return prepareCorrection(target,'Review legacy Standard defaults',JSON.stringify({action:'patch',changes:{profiles}}),records);
}

/** Validate a profile's current packages as inert data, then use the shared CAS/Undo review. */
export async function prepareHarnessProfileChange(records:any[],profileId:string,builtins:readonly ToolPackage[]){
 const targets=records.filter(record=>record.id==='settings-harness');
 if(targets.length!==1)throw Error('Harness settings unavailable');
 const target=targets[0],{group,value}=settingsCorrectionTarget(target);
 if(group!=='harness')throw Error('Harness settings unavailable');
 const profile=(value as unknown as HarnessPreferences).profiles.find(item=>item.id===profileId);
 if(!profile)throw Error('Profile unavailable');
 if(profile.enabledTools.some(id=>!id.startsWith('user.')&&!builtins.some(pkg=>pkg.definition.id===id)))throw Error('Selected tool is not registered');
 return prepareCorrection(target,'Use profile: '+profile.label,JSON.stringify({action:'patch',changes:{activeProfileId:profile.id}}),records);
}

/** Make a newly installed tool available to the current agent in the same local save. */
export function addToolToActiveProfile<T extends PreferenceRecord>(records:T[],toolId:string):T[]{
 if(!/^user\.[a-z][a-z0-9-]{0,47}$/.test(toolId))throw Error('Custom tool ID unavailable');
 const target=records.find(record=>record.id==='settings-harness');
 if(!target||target.path!=='Settings/harness.md'||target.managed!==true||target.protected)throw Error('Harness settings unavailable');
 const preferences=parsePreference('harness',target.body) as unknown as HarnessPreferences;
 const profile=preferences.profiles.find(item=>item.id===preferences.activeProfileId);
 if(!profile)throw Error('Active profile unavailable');
 if(profile.enabledTools.includes(toolId))throw Error('Tool already exists in the active profile');
 if(profile.enabledTools.length>=MAX_CONFIGURED_AGENT_TOOLS)throw Error('Active profile has reached its local tool limit');
 return updatePreference('harness',records,current=>({...current,profiles:current.profiles.map(item=>item.id===profile.id?{...item,enabledTools:[...item.enabledTools,toolId]}:item)}));
}
