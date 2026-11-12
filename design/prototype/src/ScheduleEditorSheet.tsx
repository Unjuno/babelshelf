import { Bell, CaretDown } from '@phosphor-icons/react';
import { KeyboardInput, KeyboardTextarea } from './mobile';
import { repeatOptions } from './schedule-time';

export type ScheduleEditorDraft = {
 id:string|null;
 prompt:string;
 repeat:string;
 time:string;
 notify:boolean;
 days:number[];
 date:string;
 monthDay:string;
 interval:string;
 unit:string;
};

type Props={
 draft:ScheduleEditorDraft;
 enabled:boolean;
 saving:boolean;
 storagePending:boolean;
 error:string;
 nextOccurrence:string;
 timezone:string;
 onDraftChange:(patch:Partial<ScheduleEditorDraft>)=>void;
 onRepeatOpen:()=>void;
 onFormEdit:()=>void;
 onCancel:()=>void;
 onSave:()=>void;
};

const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/** Schedule-specific form presentation. Persistence and occurrence validation remain with the parent workflow. */
export function ScheduleEditorSheet({draft,enabled,saving,storagePending,error,nextOccurrence,timezone,onDraftChange,onRepeatOpen,onFormEdit,onCancel,onSave}:Props){
 return <form className="schedule-form creation-form schedule-form--task" onChange={onFormEdit} onSubmit={event=>{event.preventDefault();onSave();}}>
  <div className="task-fields">
   {!draft.id&&<div className="source-revision" role="status">New schedules start paused. Turn on Enable after saving to run them.</div>}
   <label>Prompt<KeyboardTextarea aria-label="Schedule prompt" aria-invalid={error==='Enter a prompt'} aria-describedby={error==='Enter a prompt'?'schedule-prompt-error':undefined} value={draft.prompt} onChange={event=>onDraftChange({prompt:event.target.value})} placeholder="Prompt" rows={4}/></label>
   {error==='Enter a prompt'&&<div className="creation-error" id="schedule-prompt-error" role="alert">{error}</div>}
   <div className="schedule-repeat-field"><span>Repeat</span><button type="button" className="model-picker" aria-label="Repeat" aria-haspopup="dialog" onClick={onRepeatOpen}><span>{repeatOptions.find(option=>option.value===draft.repeat)?.label}</span><CaretDown size={17}/></button></div>
   {draft.repeat==='weekly'&&<div className="weekday-picker" role="group" aria-label="Weekdays">{weekdays.map((day,index)=><button type="button" key={day} aria-pressed={draft.days.includes(index)} onClick={()=>onDraftChange({days:draft.days.includes(index)?draft.days.filter(value=>value!==index):[...draft.days,index].sort()})}>{day}</button>)}</div>}
   {(draft.repeat==='once'||draft.repeat==='custom')&&<label>{draft.repeat==='once'?'Date':'Start date'}<KeyboardInput aria-label="Schedule date" aria-invalid={error==='Invalid date'||error==='Use YYYY-MM-DD'} aria-describedby="schedule-next" value={draft.date} onChange={event=>onDraftChange({date:event.target.value})} placeholder="YYYY-MM-DD"/></label>}
   {draft.repeat==='monthly'&&<><label>Day of month<KeyboardInput aria-label="Day of month" inputMode="numeric" value={draft.monthDay} onChange={event=>onDraftChange({monthDay:event.target.value})}/></label><span className="schedule-note">Months without this day are skipped</span></>}
   {draft.repeat==='custom'&&<><label>Every<KeyboardInput aria-label="Repeat interval" inputMode="numeric" value={draft.interval} onChange={event=>onDraftChange({interval:event.target.value})}/></label><div className="appearance-options" role="group" aria-label="Interval unit">{(['days','weeks'] as const).map(unit=><button type="button" key={unit} aria-pressed={draft.unit===unit} onClick={()=>onDraftChange({unit})}>{unit==='days'?'Days':'Weeks'}</button>)}</div></>}
   <label>Time<KeyboardInput aria-label="Schedule time" aria-invalid={error==='Use HH:MM'} aria-describedby="schedule-next" inputMode="numeric" value={draft.time} onChange={event=>onDraftChange({time:event.target.value})} placeholder="09:00"/></label>
   <label className="notify-row"><span><Bell size={18}/>In-app notification</span><input type="checkbox" role="switch" checked={draft.notify} onChange={event=>onDraftChange({notify:event.target.checked})}/></label>
   <div className="next-occurrence" id="schedule-next">Device time · {timezone}<br/>{error||`${!draft.id||!enabled?'Next if enabled':'Next'} · ${nextOccurrence}`}</div>
  </div>
  <div className="action-row"><button type="button" className="quiet-button" disabled={saving} onClick={onCancel}>Cancel</button><button className="solid-button" disabled={storagePending||saving} type="submit">Save</button></div>
 </form>;
}
