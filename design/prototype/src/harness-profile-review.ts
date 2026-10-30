import {prepareCorrection} from './note-corrections.ts';
import {settingsCorrectionTarget} from './settings-corrections.ts';
import {parsePreference,updatePreference,type HarnessPreferences,type PreferenceRecord} from './preference-records.ts';
import {MAX_CONFIGURED_AGENT_TOOLS} from './agent-loop.ts';
import type {ToolPackage} from './tools/tool-registry.ts';

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
