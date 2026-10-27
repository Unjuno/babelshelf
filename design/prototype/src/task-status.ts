import {taskDefinition,type Task,type RunData} from './task-records.ts';
type Scheduled=Task&{id:string;nextAt?:string|null;requiresReview?:boolean};
type Occurrence=Pick<RunData,'taskId'|'definition'|'dueAt'|'status'>;
export function scheduleStatus(task:Scheduled,runs:Occurrence[],active:string|null,timezone:string){
 if(task.requiresReview)return 'Review schedule';if(task.timezone!==timezone)return 'Timezone changed';if(active===task.id)return 'Running';if(!task.nextAt)return 'Completed';
 const run=runs.find(r=>r.taskId===task.id&&r.definition===taskDefinition(task)&&r.dueAt===task.nextAt);
 if(run&&['running','missed','failed','stopped','interrupted'].includes(run.status)){const state=run.status[0].toUpperCase()+run.status.slice(1);return run.status!=='running'&&!task.enabled?state+' · Paused':state;}
 return task.enabled?'Enabled':'Paused';
}
export function scheduleRunAction(run?:Occurrence){return run?.status==='running'?'Check execution':run?'Retry':'Run now';}
