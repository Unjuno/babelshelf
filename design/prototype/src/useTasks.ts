import {useEffect,useRef,useState} from 'react';
import {knowledge} from './useKnowledge';
import type {NoteView} from './knowledge-store';
import {parseTask,taskRunView,noticeView,taskDefinition,type Task,type RunData,type NoticeData} from './task-records';
export type TaskView=Task&{id:string;title:string;version:number;path:string;nextAt?:string|null;requiresReview?:boolean};
export type ExecutionView=RunData&{id:string;version:number;path:string};
export type NotificationView=NoticeData&{id:string;scheduleId:string};
function raw(n:NoteView){return {ui:{recordType:n.recordType},revisions:[{version:n.version,body:n.body}]};}
export function taskViews(notes:NoteView[]){
 const tasks:TaskView[]=[],executions:ExecutionView[]=[],notifications:NotificationView[]=[],errors:string[]=[];
 for(const n of notes)try{
  if(n.recordType==='schedule'){const task=parseTask(n.body);tasks.push({...task,id:n.id,title:task.prompt.trim().split('\n')[0].slice(0,72),version:n.version,path:n.path,nextAt:n.nextAt,requiresReview:n.requiresReview});}
  else if(n.recordType==='execution')executions.push({...taskRunView(raw(n)),id:n.id,path:n.path,version:n.version});
  else if(n.recordType==='notification'){const notice=noticeView(raw(n));notifications.push({...notice,id:n.id,scheduleId:notice.taskId});}
 }catch(e){errors.push(n.path+' · '+(e as Error).message);}
 executions.sort((a,b)=>b.startedAt.localeCompare(a.startedAt));notifications.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));return {tasks,executions,notifications,errors};
}
export function useTasks(notes:NoteView[],ready:boolean,blocked:boolean|(()=>boolean),refresh:()=>Promise<void>,execute:(prompt:string)=>Promise<{answer:string;sources:any[];model?:RunData['model']}>){
 const views=taskViews(notes),[active,setActive]=useState<string|null>(null),[error,setError]=useState(''),[saving,setSaving]=useState(false),savingLock=useRef(false),owner=useRef(crypto.randomUUID()),locked=useRef(false);
 const latest=useRef({views,blocked,refresh,execute});latest.current={views,blocked,refresh,execute};
 const isBlocked=()=>typeof latest.current.blocked==='function'?latest.current.blocked():latest.current.blocked;
 async function run(id:string,retry=false,manual=true){
  if(locked.current||isBlocked())throw Error('Model busy');locked.current=true;setActive(id);setError('');let runId:string|undefined,heartbeat:ReturnType<typeof setInterval>|undefined;
  try{
   const claim=await knowledge.claimRun(id,owner.current,{retry,manual});await latest.current.refresh();if(!claim.execute)return;
   runId=claim.run.id;heartbeat=setInterval(()=>{knowledge.heartbeat(runId!,owner.current).catch(e=>setError(e.message));},20000);
   try{const output=await latest.current.execute(taskRunView(claim.run).prompt);await knowledge.finishRun(runId!,owner.current,{status:'succeeded',...output});}
   catch(e){const message=(e as Error).message;await knowledge.finishRun(runId!,owner.current,{status:message==='Stopped'?'stopped':'failed',error:message});if(manual)setError(message);}
  }finally{if(heartbeat)clearInterval(heartbeat);locked.current=false;setActive(null);await latest.current.refresh();}
 }
 async function skip(id:string){await knowledge.skipRun(id,owner.current);await latest.current.refresh();}
 async function save(task:Task,id?:string,expected?:number,creationId?:string){if(savingLock.current)throw Error('Saving');savingLock.current=true;setSaving(true);try{const note=await knowledge.putTask(task,id,expected,creationId);try{await latest.current.refresh();return {note,refreshError:null};}catch(e){return {note,refreshError:e as Error};}}finally{savingLock.current=false;setSaving(false);}}
 async function read(id:string){await knowledge.readNotification(id);await latest.current.refresh();}
 useEffect(()=>{if(!ready)return;let stopped=false;
  const poll=async()=>{if(stopped||document.visibilityState!=='visible'||locked.current||isBlocked())return;
   try{const fresh=taskViews(await knowledge.views());const due=fresh.tasks.find(t=>t.enabled&&!t.requiresReview&&t.nextAt&&new Date(t.nextAt)<=new Date()&&!fresh.executions.some(r=>r.taskId===t.id&&r.definition===taskDefinition(t)&&r.dueAt===t.nextAt&&r.status!=='running'));
    if(due)await run(due.id,false,false);else await latest.current.refresh();
   }catch(e){if(!/already|not due|disabled|Timezone changed|Model busy/.test((e as Error).message))setError((e as Error).message);}
  };
  const timer=setInterval(poll,15000);const resume=()=>{if(document.visibilityState==='visible')void poll();};document.addEventListener('visibilitychange',resume);void poll();
  return()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',resume);};
 },[ready]);
 return {...views,get busy(){return locked.current;},active,error,saving,run,skip,save,read,dismissError:()=>setError('')};
}
