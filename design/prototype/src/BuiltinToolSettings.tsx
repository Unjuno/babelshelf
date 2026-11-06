import {builtinTools,builtinToolIds} from './tools/builtin-tools.ts';
import type {HarnessProfile} from './preference-records.ts';

export function BuiltinToolSettings({profile,disabled,onChange}:{profile:HarnessProfile;disabled:boolean;onChange:(id:string,enabled:boolean)=>void}){
 return <section aria-label="Built-in tools"><h2>Tools</h2>{builtinTools.map(({tool,settingsLabel})=>{
  const id=tool.definition.id;
  const enabled=profile.enabledTools.includes(id),locked=disabled||profile.maxToolCalls===0||enabled&&profile.enabledTools.length===1;
  return <label className="setting-row" key={id}><span>{settingsLabel}</span><input type="checkbox" role="switch" aria-label={settingsLabel} checked={enabled} disabled={locked} onChange={event=>onChange(id,event.target.checked)}/></label>;
 })}{profile.maxToolCalls===0?<p className="source-revision">Choose a profile with tools to enable them.</p>:profile.enabledTools.length===1&&builtinToolIds.includes(profile.enabledTools[0] as (typeof builtinToolIds)[number])?<p className="source-revision">Keep at least one tool on.</p>:null}</section>;
}
