import {Clock,DotsThree,Plus} from '@phosphor-icons/react';
import {scheduleSummary} from './schedule-time';
import type {TaskView} from './useTasks';

export type ScheduleScreenProps={
 schedules:TaskView[];
 active:string|null;
 stopping:boolean;
 finishing:boolean;
 saving:boolean;
 errors:string[];
 statusLabel:(schedule:TaskView)=>string;
 onNew:()=>void;
 onEdit:(schedule:TaskView)=>void;
 onToggle:(schedule:TaskView,enabled:boolean)=>void;
 onActions:(id:string)=>void;
 onStop:()=>void;
};

export function ScheduleScreen({schedules,active,stopping,finishing,saving,errors,statusLabel,onNew,onEdit,onToggle,onActions,onStop}:ScheduleScreenProps){
 return <main className="secondary-screen schedule-screen">
  <div className="page-heading">
   <h1>Schedule</h1>
   <button className="icon-button" aria-label="New schedule" onClick={onNew}><Plus size={22}/></button>
  </div>
  <div className={'schedule-scope'+(active?' schedule-run-status':'')} role={active?'status':undefined}>
   {active?<>
    <span>{finishing?'Saving result…':stopping?'Stopping…':'Running'}</span>
    {!finishing&&<button className="quiet-button" aria-label="Stop scheduled run" disabled={stopping} onClick={onStop}>Stop</button>}
   </>:'Runs while visible'}
  </div>
  {errors.map(error=><div className="turn-status" key={error}>{error}</div>)}
  <div className="schedule-group">
   {schedules.length?schedules.map(schedule=><div className="schedule-row" key={schedule.id}>
    <button className="schedule-detail" onClick={()=>onEdit(schedule)}>
     <span className="schedule-name">{schedule.title}</span>
     <span className="schedule-meta">{scheduleSummary(schedule)} · {statusLabel(schedule)}</span>
    </button>
    <input type="checkbox" role="switch" aria-label={'Enable '+schedule.title} checked={schedule.enabled} disabled={saving||schedule.requiresReview} onChange={event=>onToggle(schedule,event.target.checked)}/>
    <button className="icon-button" aria-label={'Schedule actions for '+schedule.title} onClick={()=>onActions(schedule.id)}><DotsThree size={22}/></button>
   </div>):<div className="schedule-empty"><Clock size={27}/><span>No schedules</span></div>}
  </div>
 </main>;
}
