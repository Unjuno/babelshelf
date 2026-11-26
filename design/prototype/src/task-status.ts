import {taskDefinition,type Task,type RunData} from './task-records.ts';
type Scheduled=Task&{id:string;nextAt?:string|null;requiresReview?:boolean};
type Occurrence=Pick<RunData,'taskId'|'definition'|'dueAt'|'status'|'manualRerun'|'startedAt'>;
function latestManualExecution(task:Scheduled,runs:Occurrence[]){
 return runs.filter(run=>run.taskId===task.id&&run.definition===taskDefinition(task)&&run.manualRerun)
  .sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];
}
export function currentScheduleExecution(task:Scheduled,runs:Occurrence[]){
 const current=(run:Occurrence)=>run.taskId===task.id&&run.definition===taskDefinition(task);
 const occurrence=runs.find(run=>current(run)&&run.dueAt===task.nextAt);
 if(occurrence)return occurrence;
 const manual=!task.nextAt?latestManualExecution(task,runs):undefined;
 return manual&&['running','failed','stopped','interrupted'].includes(manual.status)?manual:undefined;
}
export function scheduleStatus(task:Scheduled,runs:Occurrence[],active:string|null,timezone:string){
 if(task.requiresReview)return 'Review schedule';if(task.timezone!==timezone)return 'Timezone changed';if(active===task.id)return 'Running';if(!task.nextAt){const manual=latestManualExecution(task,runs);if(manual&&['running','failed','stopped','interrupted'].includes(manual.status))return `${manual.status==='running'?'Running · check execution':manual.status[0].toUpperCase()+manual.status.slice(1)} · Manual run`;return 'Completed';}
 const run=runs.find(r=>r.taskId===task.id&&r.definition===taskDefinition(task)&&r.dueAt===task.nextAt);
 if(run&&['running','missed','failed','stopped','interrupted'].includes(run.status)){const state=run.status==='running'?'Running · check execution':run.status[0].toUpperCase()+run.status.slice(1);return run.status!=='running'&&!task.enabled?state+' · Paused':state;}
 return task.enabled?'Enabled':'Paused';
}
export function scheduleRunAction(run?:Occurrence){return run?.status==='running'?'Check execution':run?'Retry':'Run now';}
