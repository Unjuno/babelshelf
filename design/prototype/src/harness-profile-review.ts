import {prepareCorrection} from './note-corrections.ts';
import {settingsCorrectionTarget} from './settings-corrections.ts';
import type {HarnessPreferences} from './preference-records.ts';
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
