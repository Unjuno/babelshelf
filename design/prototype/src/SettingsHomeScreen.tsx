import {CaretRight} from '@phosphor-icons/react';
import type {PreferenceGroup} from './preference-records.ts';

export type SettingsHomePanel='models'|'media'|'appearance'|'connection'|'files'|'agent'|'tools'|'help'|'licenses';

interface SettingsHomeScreenProps {
 recoveryNeeded:boolean;
 recoveryGroups:PreferenceGroup[];
 recoveringGroup:PreferenceGroup|null;
 onRecoverGroup:(group:PreferenceGroup)=>void;
 onOpenPanel:(panel:SettingsHomePanel)=>void;
 onOpenDeveloper:()=>void;
 onOpenToolFiles:()=>void;
 onRestoreDefaults:()=>void;
}

export function SettingsHomeScreen({recoveryNeeded,recoveryGroups,recoveringGroup,onRecoverGroup,onOpenPanel,onOpenDeveloper,onOpenToolFiles,onRestoreDefaults}:SettingsHomeScreenProps){
 const recoveryLabels:Record<PreferenceGroup,string>={models:'Models',appearance:'Appearance',connection:'Connection',harness:'Assistant'};
 return <section className="settings-categories">
  {recoveryNeeded&&<div className="turn-status" role="alert">Settings need recovery</div>}
  {recoveryGroups.map(group=><button className="settings-action" key={group} aria-label={`Recover ${recoveryLabels[group]} settings`} title="Uses the last compatible version or app default. All versions stay in History." disabled={recoveringGroup!==null} onClick={()=>onRecoverGroup(group)}><span>{recoveringGroup===group?'Recovering…':'Recover '+recoveryLabels[group]}</span><CaretRight size={18}/></button>)}
  {([
   {id:'models',label:'Models'},
   {id:'media',label:'Files & media'},
   {id:'appearance',label:'Appearance'},
   {id:'connection',label:'Connection'},
   {id:'files',label:'Local files'},
  ] as const).map(item=><button className="settings-action" key={item.id} onClick={()=>onOpenPanel(item.id)}>{item.label}<CaretRight size={18}/></button>)}
  <details className="settings-more">
   <summary><span>More</span><CaretRight size={18} aria-hidden="true"/></summary>
   <div className="settings-more-items">
    <button className="settings-action" onClick={()=>onOpenPanel('agent')}>Assistant<CaretRight size={18}/></button>
    <button className="settings-action" onClick={()=>onOpenPanel('tools')}>Tools<CaretRight size={18}/></button>
    <button className="settings-action" onClick={onOpenDeveloper}>Developer<CaretRight size={18}/></button>
    <button className="settings-action" onClick={onOpenToolFiles}>Tool files<CaretRight size={18}/></button>
    <button className="settings-action" onClick={onRestoreDefaults}>Restore defaults<CaretRight size={18}/></button>
   </div>
  </details>
  <div className="settings-support" aria-label="Help and legal">
   <button className="settings-action" onClick={()=>onOpenPanel('help')}>Help<CaretRight size={18}/></button>
   <button className="settings-action" onClick={()=>onOpenPanel('licenses')}>Licenses<CaretRight size={18}/></button>
  </div>
 </section>;
}
