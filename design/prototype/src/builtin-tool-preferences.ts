import {SAFE_AGENT_TOOL_IDS} from './agent-loop.ts';
import type {HarnessPreferences} from './preference-records.ts';

export function setBuiltinToolEnabled<T extends HarnessPreferences>(value:T,profileId:string,id:string,enabled:boolean):T{
 if(!SAFE_AGENT_TOOL_IDS.includes(id as (typeof SAFE_AGENT_TOOL_IDS)[number])||value.activeProfileId!==profileId)return value;
 const profile=value.profiles.find(item=>item.id===profileId);
 if(!profile||profile.maxToolCalls===0||profile.enabledTools.includes(id)===enabled||!enabled&&profile.enabledTools.length===1)return value;
 return {...value,profiles:value.profiles.map(item=>item.id!==profileId?item:{...item,enabledTools:enabled?[...item.enabledTools,id]:item.enabledTools.filter(tool=>tool!==id)})};
}
